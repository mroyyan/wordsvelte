// End-to-end smoke test against a running instance (wrangler pages dev, or vite dev).
//   node scripts/e2e-smoke.mjs http://127.0.0.1:8799
// Expects a FRESH database (no users yet) with migrations applied.
import AdmZip from 'adm-zip'

const BASE = (process.argv[2] || 'http://127.0.0.1:8799').replace(/\/$/, '')
let failures = 0
let passes = 0

function check(name, cond, extra = '') {
  if (cond) { passes++; console.log(`  ok   ${name}`) }
  else { failures++; console.log(`  FAIL ${name} ${extra}`) }
}

async function req(path, { method = 'GET', token, body, form, headers = {}, cookie, origin = BASE } = {}) {
  const h = { ...headers }
  if (token) h.Authorization = `Bearer ${token}`
  if (cookie) h.Cookie = cookie
  if (origin && method !== 'GET') h.Origin = origin
  let payload
  if (form) payload = form
  else if (body !== undefined) { payload = JSON.stringify(body); h['Content-Type'] = 'application/json' }
  const res = await fetch(BASE + path, { method, headers: h, body: payload, redirect: 'manual' })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, text, json, headers: res.headers }
}

const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
])
const fileForm = (bytes, name, type) => { const f = new FormData(); f.set('file', new File([bytes], name, { type })); return f }

const admin = { email: 'admin@e2e.test', username: 'e2e_admin', password: 'e2e-admin-password', displayName: 'E2E Admin' }

console.log(`E2E against ${BASE}\n`)

console.log('first-run setup')
check('needsSetup initially', (await req('/api/auth/setup')).json?.data?.needsSetup === true)
const setup = await req('/api/auth/setup', { method: 'POST', body: admin })
check('setup creates admin (201)', setup.status === 201, setup.text.slice(0, 200))
check('setup sets httpOnly cookie', /wordsvelte_token=.+HttpOnly/i.test(setup.headers.get('set-cookie') || ''))
check('second setup refused (403)', (await req('/api/auth/setup', { method: 'POST', body: { ...admin, email: 'x@e2e.test', username: 'x_user_e2e' } })).status === 403)
const adminToken = setup.json.data.token

console.log('secrets never leak')
const pub = await req('/api/settings')
check('public settings 200', pub.status === 200)
check('no jwt_secret in /api/settings', !/jwt_secret|e2e-secret/.test(pub.text))
const home = await req('/')
check('home page renders (200)', home.status === 200, String(home.status))
check('no secret in home HTML', !/jwt_secret|e2e-secret/.test(home.text))
check('security headers present', home.headers.get('x-content-type-options') === 'nosniff' && home.headers.get('x-frame-options') === 'SAMEORIGIN')

console.log('authentication')
check('anonymous /api/users is 401', (await req('/api/users')).status === 401)
check('public self-registration is gone', (await req('/api/auth/register', { method: 'POST', body: { ...admin, email: 'z@e2e.test', username: 'zzz_user' } })).status === 404)
check('wrong password 401', (await req('/api/auth/login', { method: 'POST', body: { email: admin.email, password: 'nope-nope-nope' } })).status === 401)
const login = await req('/api/auth/login', { method: 'POST', body: { email: admin.email.toUpperCase(), password: admin.password } })
check('login ok (case-insensitive email)', login.status === 200)
check('/api/auth/me works', (await req('/api/auth/me', { token: login.json.data.token })).json?.data?.role === 'admin')

console.log('roles')
const mk = async (role) => {
  const r = await req('/api/users', { method: 'POST', token: adminToken, body: { email: `${role}@e2e.test`, username: `e2e_${role}`, password: `${role}-password-1`, displayName: role, role } })
  check(`admin creates ${role} (201)`, r.status === 201, r.text.slice(0, 200))
  const l = await req('/api/auth/login', { method: 'POST', body: { email: `${role}@e2e.test`, password: `${role}-password-1` } })
  return l.json.data.token
}
const authorToken = await mk('author')
const editorToken = await mk('editor')
check('author cannot list users (403)', (await req('/api/users', { token: authorToken })).status === 403)
check('author cannot create admin (403)', (await req('/api/users', { method: 'POST', token: authorToken, body: { email: 'e@e2e.test', username: 'evil_admin', password: 'password-1234', displayName: 'e', role: 'admin' } })).status === 403)
check('author cannot change settings (403)', (await req('/api/settings', { method: 'PUT', token: authorToken, body: { site_name: 'pwned' } })).status === 403)
check('editor cannot change settings (403)', (await req('/api/settings', { method: 'PUT', token: editorToken, body: { site_name: 'pwned' } })).status === 403)
check('admin cannot overwrite jwt_secret', (await req('/api/settings', { method: 'PUT', token: adminToken, body: { jwt_secret: 'x' } })).status === 400)
check('admin can change site_name', (await req('/api/settings', { method: 'PUT', token: adminToken, body: { site_name: 'E2E News' } })).status === 200)

console.log('posts + XSS')
const created = await req('/api/posts', {
  method: 'POST', token: authorToken,
  body: { title: 'E2E Post', status: 'publish', content: '<p>safe</p><script>alert("xss")</script><img src=x onerror=alert(1)>' },
})
check('author creates a published post', created.status === 201, created.text.slice(0, 200))
const slug = created.json.data.slug
const page = await req(`/${slug}`)
check('post page renders', page.status === 200, String(page.status))
check('post page contains safe content', page.text.includes('<p>safe</p>'))
check('post page has no injected script/onerror', !/alert\("xss"\)|onerror=alert/.test(page.text))
const other = await req('/api/posts', { method: 'POST', token: editorToken, body: { title: 'Editor Post', content: '<p>e</p>' } })
check("author cannot edit another author's post (403)", (await req(`/api/posts-admin/${other.json.data.id}`, { method: 'PATCH', token: authorToken, body: { title: 'hijack' } })).status === 403)
check('author cannot feature posts', (await req('/api/posts', { method: 'POST', token: authorToken, body: { title: 'F', content: 'x', status: 'publish', isFeatured: true } })).json.data.isFeatured === false)
check('draft post not publicly reachable', (await req(`/${other.json.data.slug}`)).status === 404)

console.log('comments')
const postId = created.json.data.id
const cm = await req('/api/comments', { method: 'POST', body: { postId, authorName: 'Eve', authorEmail: 'eve@e2e.test', content: '<script>alert("c")</script> hello' } })
check('anonymous comment accepted (201)', cm.status === 201, cm.text.slice(0, 200))
check('comment response hides email', !cm.text.includes('eve@e2e.test'))
check('pending comment not shown on page', !(await req(`/${slug}`)).text.includes('hello'))
const approved = await req(`/api/comments/${cm.json.data.id}/status`, { method: 'PATCH', token: editorToken, body: { status: 'approved' } })
check('editor approves comment', approved.status === 200)
const after = (await req(`/${slug}`)).text
check('approved comment shown', after.includes('hello'))
check('comment HTML is escaped, not executed', !after.includes('<script>alert("c")') && !after.includes('eve@e2e.test'))
check('author cannot moderate comments (403)', (await req(`/api/comments/${cm.json.data.id}/status`, { method: 'PATCH', token: authorToken, body: { status: 'spam' } })).status === 403)

console.log('media')
const up = await req('/api/media', { method: 'POST', token: authorToken, form: fileForm(PNG, 'a.png', 'image/png') })
check('PNG upload accepted (201)', up.status === 201, up.text.slice(0, 200))
const key = up.json?.data?.r2Key
const served = await req(`/api/media/${key}`)
check('uploaded file served as image/png', served.status === 200 && served.headers.get('content-type') === 'image/png', `${served.status} ${served.headers.get('content-type')}`)
check('served with nosniff + sandbox CSP', served.headers.get('x-content-type-options') === 'nosniff' && /sandbox/.test(served.headers.get('content-security-policy') || ''))
check('HTML disguised as PNG rejected (400)', (await req('/api/media', { method: 'POST', token: authorToken, form: fileForm('<html><script>alert(1)</script>', 'x.png', 'image/png') })).status === 400)
check('SVG rejected (400)', (await req('/api/media', { method: 'POST', token: authorToken, form: fileForm('<svg onload=alert(1)/>', 'x.svg', 'image/svg+xml') })).status === 400)
check('anonymous upload rejected (401)', (await req('/api/media', { method: 'POST', form: fileForm(PNG, 'a.png', 'image/png') })).status === 401)

console.log('themes')
const zipOf = (files, rename) => {
  const z = new AdmZip()
  for (const [n, d] of Object.entries(files)) z.addFile(n, Buffer.from(d))
  if (rename) for (const e of z.getEntries()) e.entryName = rename(e.entryName)
  return z.toBuffer()
}
const good = { 'manifest.json': JSON.stringify({ name: 'E2E Theme', slug: 'e2e-theme', version: '1.0.0' }), 'templates/layout.hbs': '<html>{{{body}}}</html>', 'templates/index.hbs': '<h1>x</h1>' }
check('author cannot upload theme (403)', (await req('/api/themes/upload', { method: 'POST', token: authorToken, form: fileForm(zipOf(good), 't.zip', 'application/zip') })).status === 403)
const tu = await req('/api/themes/upload', { method: 'POST', token: adminToken, form: fileForm(zipOf(good), 't.zip', 'application/zip') })
check('admin uploads theme (201)', tu.status === 201, tu.text.slice(0, 200))
check('duplicate theme 409', (await req('/api/themes/upload', { method: 'POST', token: adminToken, form: fileForm(zipOf(good), 't.zip', 'application/zip') })).status === 409)
check('zip-slip archive rejected (400)', (await req('/api/themes/upload', { method: 'POST', token: adminToken, form: fileForm(zipOf({ ...good, 'assets/a.css': 'x' }, n => (n === 'assets/a.css' ? '../../../../evil.css' : n)), 'e.zip', 'application/zip') })).status === 400)
check('php in theme rejected (400)', (await req('/api/themes/upload', { method: 'POST', token: adminToken, form: fileForm(zipOf({ ...good, 'manifest.json': JSON.stringify({ name: 'P', slug: 'php-theme' }), 'assets/x.php': '<?php' }), 'p.zip', 'application/zip') })).status === 400)
const themes = await req('/api/themes', { token: adminToken })
check('theme list has default + uploaded', ['default', 'e2e-theme'].every(s => themes.json?.data?.some(t => t.slug === s)), themes.text.slice(0, 200))
check('uploaded theme sources are NOT readable via the public media route', (await req('/api/media/themes/e2e-theme/templates/layout.hbs')).status === 404)
check('activate unknown theme 404', (await req('/api/themes/ghost', { method: 'PUT', token: adminToken })).status === 404)
check('activate uploaded theme 200', (await req('/api/themes/e2e-theme', { method: 'PUT', token: adminToken })).status === 200)

console.log('CSRF')
check('cross-origin POST blocked (403)', (await req('/api/posts', { method: 'POST', token: authorToken, origin: 'https://evil.example', body: { title: 'x', content: 'x' } })).status === 403)
const cookieOnly = await req('/api/posts', { method: 'POST', cookie: `wordsvelte_token=${authorToken}`, origin: null, body: { title: 'x', content: 'x' } })
check('cookie-auth POST without Origin blocked (403)', cookieOnly.status === 403, String(cookieOnly.status))
const cookieSame = await req('/api/posts', { method: 'POST', cookie: `wordsvelte_token=${authorToken}`, body: { title: 'cookie ok', content: 'x' } })
check('cookie-auth POST with same Origin allowed', cookieSame.status === 201, String(cookieSame.status))

console.log('brute force')
let last = 0
for (let i = 0; i < 7; i++) last = (await req('/api/auth/login', { method: 'POST', body: { email: 'victim@e2e.test', password: 'wrong-password' } })).status
check('login throttled after repeated failures (429)', last === 429, String(last))

console.log('admin area')
const adminPage = await req('/admin')
check('/admin redirects anonymous users', adminPage.status === 302 || adminPage.status === 303, String(adminPage.status))

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures ? 1 : 0)
