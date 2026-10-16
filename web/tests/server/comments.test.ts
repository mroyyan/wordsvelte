import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { comments, posts, settings } from '@wordsvelte/shared'
import { getDb } from '$lib/server/db'
import { createPost } from '$lib/server/services/content/post.service'
import {
  createComment, listCommentsByPost, listComments, updateCommentStatus, deleteComment, getComment,
} from '$lib/server/services/content/comment.service'
import { updateSettings } from '$lib/server/services/site/settings.service'
import { ForbiddenError, NotFoundError, ValidationError } from '$lib/server/core/errors'
import { POST as submit } from '../../src/routes/api/comments/+server'
import { GET as adminList } from '../../src/routes/api/comments/admin/+server'
import { GET as getOne, DELETE as del } from '../../src/routes/api/comments/[id]/+server'
import { PATCH as setStatus } from '../../src/routes/api/comments/[id]/status/+server'
import { load as postPageLoad } from '../../src/routes/[slug]/+page.server'
import { call, makeEvent, seedUser } from '../helpers/harness'

async function publishedPost(title = 'Commentable') {
  const { user } = await seedUser('author')
  return createPost(getDb(), { title, content: '<p>x</p>', status: 'publish', authorId: user.id })
}
const valid = (postId: number, over: object = {}) => ({ postId, authorName: 'Budi', authorEmail: 'budi@example.com', content: 'Nice article', ...over })

describe('createComment', () => {
  it('creates a pending comment by default and never echoes the email back', async () => {
    const p = await publishedPost()
    const c = await createComment(getDb(), valid(p.id))
    expect(c).toMatchObject({ postId: p.id, authorName: 'Budi', content: 'Nice article', status: 'pending', parentId: null })
    expect(c).not.toHaveProperty('authorEmail')
    const [row] = await getDb().select().from(comments).where(eq(comments.id, c.id))
    expect(row.authorEmail).toBe('budi@example.com') // stored for moderators
  })

  it('auto-approves when comments_auto_approve=true', async () => {
    const p = await publishedPost()
    await updateSettings(getDb(), { comments_auto_approve: 'true' })
    expect((await createComment(getDb(), valid(p.id))).status).toBe('approved')
  })

  it('trims input and keeps html as inert text (rendered escaped by the page)', async () => {
    const p = await publishedPost()
    const c = await createComment(getDb(), valid(p.id, { authorName: '  <b>Eve</b> ', content: '  <script>alert(1)</script>  ' }))
    expect(c.authorName).toBe('<b>Eve</b>')
    expect(c.content).toBe('<script>alert(1)</script>')
  })

  it.each([
    ['no name', { authorName: '' }, /name/i],
    ['blank name', { authorName: '   ' }, /name/i],
    ['long name', { authorName: 'x'.repeat(101) }, /name/i],
    ['bad email', { authorEmail: 'nope' }, /email/i],
    ['empty content', { content: '   ' }, /comment/i],
    ['huge content', { content: 'x'.repeat(5001) }, /too long/i],
    ['non-numeric postId', { postId: 'abc' as any }, /post/i],
    ['null content', { content: null as any }, /comment/i],
  ])('rejects %s', async (_n, over, msg) => {
    const p = await publishedPost()
    const payload = { ...valid(p.id), ...over }
    await expect(createComment(getDb(), payload as any)).rejects.toThrow(msg)
    await expect(createComment(getDb(), payload as any)).rejects.toBeInstanceOf(ValidationError)
  })

  it('404 for missing and for unpublished posts (no probing drafts)', async () => {
    const { user } = await seedUser('author')
    const draft = await createPost(getDb(), { title: 'Draft', content: 'x', authorId: user.id })
    await expect(createComment(getDb(), valid(99999))).rejects.toBeInstanceOf(NotFoundError)
    await expect(createComment(getDb(), valid(draft.id))).rejects.toBeInstanceOf(NotFoundError)
  })

  it('403 when comments are disabled globally', async () => {
    const p = await publishedPost()
    await updateSettings(getDb(), { comments_enabled: 'false' })
    await expect(createComment(getDb(), valid(p.id))).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('403 once the post is older than comments_close_after_days', async () => {
    const p = await publishedPost()
    await updateSettings(getDb(), { comments_close_after_days: '30' })
    await getDb().update(posts).set({ publishedAt: new Date(Date.now() - 31 * 86_400_000).toISOString() }).where(eq(posts.id, p.id))
    await expect(createComment(getDb(), valid(p.id))).rejects.toBeInstanceOf(ForbiddenError)
    await getDb().update(posts).set({ publishedAt: new Date(Date.now() - 29 * 86_400_000).toISOString() }).where(eq(posts.id, p.id))
    await expect(createComment(getDb(), valid(p.id))).resolves.toBeTruthy()
    await updateSettings(getDb(), { comments_close_after_days: '0' }) // 0 = never close
    await getDb().update(posts).set({ publishedAt: '2001-01-01T00:00:00.000Z' }).where(eq(posts.id, p.id))
    await expect(createComment(getDb(), valid(p.id))).resolves.toBeTruthy()
  })

  it('replies must target a comment on the same post', async () => {
    const a = await publishedPost('Post A')
    const b = await publishedPost('Post B')
    const parent = await createComment(getDb(), valid(a.id))
    expect((await createComment(getDb(), valid(a.id, { parentId: parent.id }))).parentId).toBe(parent.id)
    await expect(createComment(getDb(), valid(b.id, { parentId: parent.id }))).rejects.toBeInstanceOf(ValidationError)
    await expect(createComment(getDb(), valid(a.id, { parentId: 424242 }))).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('listing', () => {
  it('listCommentsByPost returns approved comments of THAT post only (regression: chained where() dropped postId)', async () => {
    const a = await publishedPost('A')
    const b = await publishedPost('B')
    await updateSettings(getDb(), { comments_auto_approve: 'true' })
    await createComment(getDb(), valid(a.id, { content: 'on A' }))
    await createComment(getDb(), valid(b.id, { content: 'on B' }))
    await updateSettings(getDb(), { comments_auto_approve: 'false' })
    await createComment(getDb(), valid(a.id, { content: 'pending on A' }))

    const list = await listCommentsByPost(getDb(), a.id)
    expect(list.map((c: any) => c.content)).toEqual(['on A'])
    expect(JSON.stringify(list)).not.toContain('budi@example.com')
  })

  it('admin listing filters by status and paginates with clamps', async () => {
    const p = await publishedPost()
    for (let i = 0; i < 3; i++) await createComment(getDb(), valid(p.id, { content: `c${i}` }))
    const [first] = (await listComments(getDb())).data
    await updateCommentStatus(getDb(), first.id, 'spam')
    expect((await listComments(getDb(), { status: 'spam' })).total).toBe(1)
    expect((await listComments(getDb(), { status: 'pending' })).total).toBe(2)
    expect((await listComments(getDb(), { limit: 2 })).data).toHaveLength(2)
    expect((await listComments(getDb(), { limit: 9999 })).limit).toBe(100)
  })
})

describe('moderation', () => {
  it('updateCommentStatus validates status and existence', async () => {
    const p = await publishedPost()
    const c = await createComment(getDb(), valid(p.id))
    expect((await updateCommentStatus(getDb(), c.id, 'approved')).status).toBe('approved')
    await expect(updateCommentStatus(getDb(), c.id, 'deleted')).rejects.toBeInstanceOf(ValidationError)
    await expect(updateCommentStatus(getDb(), c.id, undefined as any)).rejects.toBeInstanceOf(ValidationError)
    await expect(updateCommentStatus(getDb(), 9999, 'approved')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('deleteComment 404s for unknown ids and removes the row', async () => {
    const p = await publishedPost()
    const c = await createComment(getDb(), valid(p.id))
    await deleteComment(getDb(), c.id)
    await expect(getComment(getDb(), c.id)).rejects.toBeInstanceOf(NotFoundError)
    await expect(deleteComment(getDb(), c.id)).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('comments API', () => {
  const post = (body: unknown, ip = '1.2.3.4') => call(submit, makeEvent({ method: 'POST', body, ip }))

  it('anonymous visitors can comment; response has no email; unknown post is 404', async () => {
    const p = await publishedPost()
    const r = await post(valid(p.id))
    expect(r.status).toBe(201)
    expect(r.text).not.toContain('budi@example.com')
    expect((await post(valid(99999))).status).toBe(404)
  })

  it('400 for malformed JSON / invalid input, 403 when disabled', async () => {
    const p = await publishedPost()
    expect((await post('{nope')).status).toBe(400)
    expect((await post(valid(p.id, { authorEmail: 'bad' }))).status).toBe(400)
    await updateSettings(getDb(), { comments_enabled: 'false' })
    expect((await post(valid(p.id))).status).toBe(403)
  })

  it('rate-limits to 5 submissions per minute per IP with Retry-After', async () => {
    const p = await publishedPost()
    for (let i = 0; i < 5; i++) expect((await post(valid(p.id))).status).toBe(201)
    const blocked = await post(valid(p.id))
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0)
    expect((await post(valid(p.id), '5.5.5.5')).status).toBe(201) // other IPs unaffected
  })

  it('invalid submissions do not burn the rate-limit budget', async () => {
    const p = await publishedPost()
    for (let i = 0; i < 10; i++) await post(valid(p.id, { content: '' }))
    expect((await post(valid(p.id))).status).toBe(201)
  })

  it('moderation endpoints: 401 anonymous, 403 author, OK for editor', async () => {
    const p = await publishedPost()
    const c = await createComment(getDb(), valid(p.id))
    const author = await seedUser('author')
    const editor = await seedUser('editor')
    const params = { id: String(c.id) }

    expect((await call(adminList, makeEvent())).status).toBe(401)
    expect((await call(adminList, makeEvent({ token: author.token }))).status).toBe(403)
    const list = await call(adminList, makeEvent({ token: editor.token, query: { page: 'x' } }))
    expect(list.status).toBe(200)
    expect(list.json.data[0].authorEmail).toBe('budi@example.com') // moderators do see emails

    expect((await call(getOne, makeEvent({ params, token: author.token }))).status).toBe(403)
    expect((await call(setStatus, makeEvent({ method: 'PATCH', params, token: author.token, body: { status: 'approved' } }))).status).toBe(403)
    expect((await call(del, makeEvent({ method: 'DELETE', params, token: author.token }))).status).toBe(403)

    expect((await call(setStatus, makeEvent({ method: 'PATCH', params, token: editor.token, body: { status: 'approved' } }))).json.data.status).toBe('approved')
    expect((await call(setStatus, makeEvent({ method: 'PATCH', params, token: editor.token, body: { status: 'weird' } }))).status).toBe(400)
    expect((await call(del, makeEvent({ method: 'DELETE', params, token: editor.token }))).status).toBe(200)
    expect((await call(del, makeEvent({ method: 'DELETE', params, token: editor.token }))).status).toBe(404)
  })
})

describe('public post page load', () => {
  it('returns only approved comments, no emails, sanitised HTML and no draft-leaking related posts', async () => {
    const { user } = await seedUser('author')
    const p = await createPost(getDb(), { title: 'Page', content: '<p>ok</p><script>alert(1)</script>', status: 'publish', authorId: user.id })
    await createPost(getDb(), { title: 'Secret draft', content: 'x', authorId: user.id })
    await getDb().insert(posts).values({ authorId: user.id, title: 'Unsafe', slug: 'unsafe', content: '<img src=x onerror=alert(1)>', status: 'publish' })
    await getDb().insert(comments).values([
      { postId: p.id, authorName: 'ok', authorEmail: 'hidden@secret.test', content: 'visible', status: 'approved' },
      { postId: p.id, authorName: 'no', authorEmail: 'hidden2@secret.test', content: 'pending one', status: 'pending' },
    ])

    const data: any = await postPageLoad(makeEvent({ params: { slug: p.slug } }))
    expect(data.comments.map((c: any) => c.content)).toEqual(['visible'])
    expect(JSON.stringify(data)).not.toContain('secret.test')
    expect(data.post.content).not.toMatch(/<script/i)
    expect(data.related.map((r: any) => r.title)).not.toContain('Secret draft')

    const unsafe: any = await postPageLoad(makeEvent({ params: { slug: 'unsafe' } }))
    expect(unsafe.post.content).not.toMatch(/onerror/i)
    await expect(postPageLoad(makeEvent({ params: { slug: 'secret-draft' } }))).rejects.toMatchObject({ status: 404 })
  })

  it('keeps settings untouched (sanity: nothing here wrote to settings)', async () => {
    expect((await getDb().select().from(settings).where(eq(settings.key, 'jwt_secret'))).length).toBe(0)
  })
})
