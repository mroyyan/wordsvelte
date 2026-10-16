import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'
import { eq } from 'drizzle-orm'
import { users } from '@wordsvelte/shared'
import { getDb } from '$lib/server/db'
import { createUser, createFirstAdmin, updateUser, listUsers, validateLogin, normalizeEmail } from '$lib/server/services/account/user.service'
import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from '$lib/server/core/errors'
import { GET as listRoute, POST as createRoute } from '../../src/routes/api/users/+server'
import { PATCH as patchRoute } from '../../src/routes/api/users/[id]/+server'
import { call, makeEvent, seedUser } from '../helpers/harness'

const valid = { email: 'new@example.com', username: 'new_user', password: 'a-good-password', displayName: 'New User' }

describe('createUser validation', () => {
  it('creates an author by default and never returns the hash', async () => {
    const u = await createUser(getDb(), valid)
    expect(u).toMatchObject({ email: 'new@example.com', username: 'new_user', role: 'author', displayName: 'New User' })
    expect(JSON.stringify(u)).not.toMatch(/hash|salt/i)
    const [row] = await getDb().select().from(users).where(eq(users.id, u.id))
    expect(row.passwordHash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{64}$/)
    expect(row.createdAt).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/)
  })

  it('normalises email to lowercase/trimmed and treats it case-insensitively for uniqueness', async () => {
    const u = await createUser(getDb(), { ...valid, email: '  New@Example.COM ' })
    expect(u.email).toBe('new@example.com')
    await expect(createUser(getDb(), { ...valid, username: 'other_name', email: 'NEW@example.com' })).rejects.toBeInstanceOf(ConflictError)
  })

  it('rejects duplicate usernames with a 409 instead of a DB crash', async () => {
    await createUser(getDb(), valid)
    await expect(createUser(getDb(), { ...valid, email: 'x@example.com' })).rejects.toMatchObject({ status: 409, message: 'Username already taken' })
  })

  it.each([
    ['bad email', { email: 'not-an-email' }, /email/i],
    ['empty email', { email: '' }, /email/i],
    ['email with spaces', { email: 'a b@example.com' }, /email/i],
    ['short username', { username: 'ab' }, /username/i],
    ['username with spaces', { username: 'bad name' }, /username/i],
    ['username with html', { username: '<script>' }, /username/i],
    ['short password', { password: '1234567' }, /password/i],
    ['missing password', { password: undefined as any }, /password/i],
    ['empty display name', { displayName: '   ' }, /display name/i],
    ['huge display name', { displayName: 'x'.repeat(101) }, /display name/i],
    ['unknown role', { role: 'superadmin' }, /role/i],
    ['empty role', { role: '' }, /role/i],
  ])('rejects %s', async (_n, patch, msg) => {
    await expect(createUser(getDb(), { ...valid, ...patch })).rejects.toThrow(msg)
    await expect(createUser(getDb(), { ...valid, ...patch })).rejects.toBeInstanceOf(ValidationError)
  })

  it('accepts every defined role', async () => {
    for (const role of ['admin', 'editor', 'author']) {
      const u = await createUser(getDb(), { ...valid, email: `${role}@example.com`, username: `${role}_x`, role })
      expect(u.role).toBe(role)
    }
  })
})

describe('createFirstAdmin', () => {
  it('creates an admin once, then refuses with 403', async () => {
    const admin = await createFirstAdmin(getDb(), valid)
    expect(admin.role).toBe('admin')
    await expect(createFirstAdmin(getDb(), { ...valid, email: 'b@example.com', username: 'b_user' })).rejects.toMatchObject({ status: 403 })
    expect(await getDb().select().from(users)).toHaveLength(1)
  })

  it('refuses when any user already exists', async () => {
    await seedUser('author')
    await expect(createFirstAdmin(getDb(), valid)).rejects.toBeInstanceOf(AppError)
  })

  it('exactly one of several concurrent setup attempts wins', async () => {
    const attempts = Array.from({ length: 5 }, (_, i) =>
      createFirstAdmin(getDb(), { ...valid, email: `race${i}@example.com`, username: `race_${i}` }).then(() => 'ok', () => 'fail'))
    const results = await Promise.all(attempts)
    expect(results.filter(r => r === 'ok')).toHaveLength(1)
    const rows = await getDb().select().from(users)
    expect(rows).toHaveLength(1)
    expect(rows[0].role).toBe('admin')
  })
})

describe('validateLogin', () => {
  it('returns the user for correct credentials (email case-insensitive)', async () => {
    await createUser(getDb(), valid)
    const u = await validateLogin(getDb(), 'NEW@example.com', valid.password)
    expect(u.username).toBe('new_user')
    expect(u).not.toHaveProperty('passwordHash')
  })

  it('gives the identical 401 for unknown email and wrong password', async () => {
    await createUser(getDb(), valid)
    const wrongPw = await validateLogin(getDb(), valid.email, 'wrong-password').catch(e => e)
    const unknown = await validateLogin(getDb(), 'ghost@example.com', 'wrong-password').catch(e => e)
    expect(wrongPw).toMatchObject({ status: 401, message: 'Invalid credentials' })
    expect(unknown).toMatchObject({ status: 401, message: 'Invalid credentials' })
  })

  it('does not blow up on non-string passwords', async () => {
    await createUser(getDb(), valid)
    await expect(validateLogin(getDb(), valid.email, 12345678 as any)).rejects.toMatchObject({ status: 401 })
  })
})

describe('updateUser', () => {
  it('updates name, email (normalised) and role', async () => {
    await seedUser('admin') // id 1 (protected primary)
    const actor = await seedUser('admin')
    const target = await seedUser('author')
    const updated = await updateUser(getDb(), { userId: actor.user.id }, target.user.id, { displayName: ' Renamed ', email: 'Renamed@Example.com', role: 'editor' })
    expect(updated).toMatchObject({ displayName: 'Renamed', email: 'renamed@example.com', role: 'editor' })
    expect(updated).not.toHaveProperty('passwordHash')
  })

  it('refuses invalid role values (no arbitrary strings in the role column)', async () => {
    await seedUser('admin')
    const actor = await seedUser('admin')
    const target = await seedUser('author')
    await expect(updateUser(getDb(), { userId: actor.user.id }, target.user.id, { role: 'root' })).rejects.toBeInstanceOf(ValidationError)
    await expect(updateUser(getDb(), { userId: actor.user.id }, target.user.id, { role: ['admin'] as any })).rejects.toBeInstanceOf(ValidationError)
  })

  it('protects the primary admin (id 1) and the actor\'s own account', async () => {
    const primary = await seedUser('admin')
    const actor = await seedUser('admin')
    await expect(updateUser(getDb(), { userId: actor.user.id }, primary.user.id, { role: 'author' })).rejects.toBeInstanceOf(ForbiddenError)
    await expect(updateUser(getDb(), { userId: actor.user.id }, actor.user.id, { role: 'author' })).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('404 for unknown ids, 400 for non-integer ids, 409 for taken email', async () => {
    await seedUser('admin')
    const actor = await seedUser('admin')
    const a = await seedUser('author')
    const b = await seedUser('author')
    await expect(updateUser(getDb(), { userId: actor.user.id }, 9999, {})).rejects.toBeInstanceOf(NotFoundError)
    await expect(updateUser(getDb(), { userId: actor.user.id }, NaN, {})).rejects.toBeInstanceOf(ValidationError)
    await expect(updateUser(getDb(), { userId: actor.user.id }, a.user.id, { email: b.user.email })).rejects.toBeInstanceOf(ConflictError)
    await expect(updateUser(getDb(), { userId: actor.user.id }, a.user.id, { email: a.user.email })).resolves.toBeTruthy() // own email is not a conflict
  })
})

describe('listUsers', () => {
  it('paginates, clamps limits and exposes no password hashes', async () => {
    for (let i = 0; i < 5; i++) await seedUser('author')
    const page = await listUsers(getDb(), { page: 1, limit: 2 })
    expect(page.data).toHaveLength(2)
    expect(page.total).toBe(5)
    expect(page.totalPages).toBe(3)
    expect(JSON.stringify(page.data)).not.toContain('passwordHash')
    expect((await listUsers(getDb(), { limit: 100000 })).limit).toBe(100)
    expect((await listUsers(getDb(), { page: -3, limit: -1 })).page).toBe(1)
  })
})

describe('normalizeEmail', () => {
  it('handles non-strings', () => {
    expect(normalizeEmail(undefined)).toBe('')
    expect(normalizeEmail(null)).toBe('')
    expect(normalizeEmail('  A@B.c ')).toBe('a@b.c')
  })
})

describe('users API', () => {
  it('self-registration endpoint no longer exists', () => {
    expect(existsSync(join(__dirname, '../../src/routes/api/auth/register/+server.ts'))).toBe(false)
  })

  it('401 anonymous / 403 author+editor / 200 admin on list', async () => {
    const [author, editor, admin] = [await seedUser('author'), await seedUser('editor'), await seedUser('admin')]
    expect((await call(listRoute, makeEvent())).status).toBe(401)
    expect((await call(listRoute, makeEvent({ token: author.token }))).status).toBe(403)
    expect((await call(listRoute, makeEvent({ token: editor.token }))).status).toBe(403)
    const ok = await call(listRoute, makeEvent({ token: admin.token, query: { limit: 'abc', page: '-5' } }))
    expect(ok.status).toBe(200)
    expect(ok.json.total).toBe(3)
    expect(ok.text).not.toMatch(/passwordHash|password_hash/)
  })

  it('POST creates users for admins only and enforces validation/conflicts', async () => {
    const author = await seedUser('author')
    const admin = await seedUser('admin')
    const body = { ...valid, role: 'editor' }
    expect((await call(createRoute, makeEvent({ method: 'POST', body }))).status).toBe(401)
    expect((await call(createRoute, makeEvent({ method: 'POST', body, token: author.token }))).status).toBe(403)

    const created = await call(createRoute, makeEvent({ method: 'POST', body, token: admin.token }))
    expect(created.status).toBe(201)
    expect(created.json.data.user).toMatchObject({ email: valid.email, role: 'editor' })

    expect((await call(createRoute, makeEvent({ method: 'POST', body, token: admin.token }))).status).toBe(409)
    expect((await call(createRoute, makeEvent({ method: 'POST', body: { ...body, email: 'x@y.z', username: 'zz_zz', role: 'god' }, token: admin.token }))).status).toBe(400)
    expect((await call(createRoute, makeEvent({ method: 'POST', body: '{not json', token: admin.token }))).status).toBe(400)
    expect((await call(createRoute, makeEvent({ method: 'POST', body: '[]', token: admin.token }))).status).toBe(400)
  })

  it('PATCH: admin-only, validates role, cannot touch self or primary admin', async () => {
    const primary = await seedUser('admin')
    const admin = await seedUser('admin')
    const author = await seedUser('author')
    const target = await seedUser('author')
    const patch = (token: string | undefined, id: number, body: object) =>
      call(patchRoute, makeEvent({ method: 'PATCH', params: { id: String(id) }, body, token }))

    expect((await patch(undefined, target.user.id, { role: 'editor' })).status).toBe(401)
    expect((await patch(author.token, target.user.id, { role: 'admin' })).status).toBe(403) // privilege escalation attempt
    expect((await patch(admin.token, target.user.id, { role: 'editor' })).json.data.role).toBe('editor')
    expect((await patch(admin.token, target.user.id, { role: 'hacker' })).status).toBe(400)
    expect((await patch(admin.token, primary.user.id, { role: 'author' })).status).toBe(403)
    expect((await patch(admin.token, admin.user.id, { role: 'author' })).status).toBe(403)
    expect((await patch(admin.token, 424242, { role: 'author' })).status).toBe(404)
    expect((await patch(admin.token, NaN, {})).status).toBe(400)
  })
})
