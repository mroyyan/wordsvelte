#!/usr/bin/env node
// npx wordsvelte            create a site and (optionally) put it online on Cloudflare
// npx wordsvelte deploy     in a site directory: create the database, bucket and secret on Cloudflare and deploy (also for a site made with "Skip")
// npx wordsvelte upgrade    in a site directory: pull the new version, run new migrations, deploy
// npx wordsvelte migrate    in a site directory: run only the migrations that are new on the remote database
import { createInterface } from 'node:readline'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'

const REPO = 'https://github.com/mroyyan/wordsvelte.git'
const C = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', underline: '\x1b[4m' }
const c = (color, text) => `${color}${text}${C.reset}`
const header = text => console.log(`\n${c(C.bold + C.cyan, '◆')} ${c(C.bold, text)}`)
const step = text => console.log(`  ${c(C.dim, '○')} ${text}`)
const good = text => console.log(`  ${c(C.green, '✔')} ${text}`)
const warn = text => console.log(`  ${c(C.yellow, '⚠')} ${text}`)
const fail = text => console.log(`  ${c(C.red, '✖')} ${text}`)

const ask = q => new Promise(done => {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  rl.question(`  ${c(C.dim, '?')} ${q} `, a => { rl.close(); done(a.trim()) })
})
const yes = async q => /^y(es)?$/i.test(await ask(`${q} (y/n):`))

/** Runs a command through the shell (so `npx` works on Windows too). `silent` captures the output instead of showing it. */
function sh(cmd, { cwd, silent = false, input } = {}) {
  const r = spawnSync(cmd, { cwd, shell: true, input, encoding: 'utf8', stdio: silent || input !== undefined ? ['pipe', 'pipe', 'pipe'] : 'inherit' })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  return { ok: r.status === 0, out }
}
const why = out => out.trim().split('\n').slice(-4).join('\n    ')

/** Names for the Cloudflare resources, from the project directory name: "My News" -> my-news */
const slugOf = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'wordsvelte'

const wranglerToml = ({ slug, databaseId }) => `name = "${slug}"
compatibility_date = "${new Date().toISOString().split('T')[0]}"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".svelte-kit/cloudflare"

[[d1_databases]]
binding = "DB"
database_name = "${slug}-db"
database_id = "${databaseId}"

[[r2_buckets]]
binding = "R2"
bucket_name = "${slug}-media"

# JWT_SECRET is a Pages secret (npx wrangler pages secret put JWT_SECRET --project-name ${slug}); create sets it for you.
# In local development a random secret is generated and kept in the local database.
`

/** What the site's wrangler.toml says: the Pages project and the D1 database. */
function readSite(dir) {
  const file = join(dir, 'web', 'wrangler.toml')
  if (!existsSync(file)) return null
  const toml = readFileSync(file, 'utf8')
  const slug = /^name\s*=\s*"([^"]+)"/m.exec(toml)?.[1]
  const db = /database_name\s*=\s*"([^"]+)"/m.exec(toml)?.[1]
  const id = /database_id\s*=\s*"([^"]+)"/m.exec(toml)?.[1]
  return slug && db ? { slug, db, id } : null
}

const webDir = dir => join(dir, 'web')
const migrationFiles = dir => readdirSync(join(webDir(dir), 'drizzle')).filter(f => f.endsWith('.sql')).sort()

/** `wrangler d1 execute --json` prints the result array, maybe after a few lines of noise. */
function parseRows(out) {
  const start = out.indexOf('[')
  if (start < 0) return null
  try { return JSON.parse(out.slice(start))[0]?.results ?? [] } catch { return null }
}
const query = (dir, db, sql) => sh(`npx wrangler d1 execute ${db} --remote --json --command "${sql}"`, { cwd: webDir(dir), silent: true })

/**
 * Runs the migrations that are new on the remote database. What has run is recorded in a table of its own, so
 * upgrading is the same command as installing. `alreadyApplied`: for a database that was set up by hand before this
 * existed, the last migration file you ran (everything up to it is recorded without running).
 */
function migrate(dir, db, { alreadyApplied } = {}) {
  const made = query(dir, db, 'CREATE TABLE IF NOT EXISTS _wordsvelte_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)')
  if (!made.ok) { fail(`Could not reach the database "${db}":\n    ${why(made.out)}`); return false }
  const done = parseRows(query(dir, db, 'SELECT name FROM _wordsvelte_migrations').out)
  if (!done) { fail('Could not read which migrations have run.'); return false }
  const files = migrationFiles(dir)
  const record = f => query(dir, db, `INSERT OR IGNORE INTO _wordsvelte_migrations (name, applied_at) VALUES ('${f}', datetime('now'))`)

  const applied = new Set(done.map(r => r.name))
  if (alreadyApplied) {
    const upTo = files.indexOf(alreadyApplied)
    if (upTo < 0) { fail(`No migration file named "${alreadyApplied}" in web/drizzle.`); return false }
    for (const f of files.slice(0, upTo + 1)) if (!applied.has(f)) { record(f); applied.add(f) }
  } else if (applied.size === 0) {
    // a database that has the tables but no record: running everything again would fail halfway
    const hasTables = parseRows(query(dir, db, "SELECT name FROM sqlite_master WHERE type='table' AND name='posts'").out)
    if (hasTables?.length) {
      fail(`The database already has tables but no migration record. Tell me the last migration you ran, for example:\n    npx wordsvelte migrate --applied ${files.at(-1)}`)
      return false
    }
  }

  const pending = files.filter(f => !applied.has(f))
  if (!pending.length) { good('Database is up to date'); return true }
  for (const f of pending) {
    step(`Applying ${f}`)
    const r = sh(`npx wrangler d1 execute ${db} --remote --yes --file=drizzle/${f}`, { cwd: webDir(dir), silent: true })
    if (!r.ok) { fail(`${f} failed:\n    ${why(r.out)}`); return false }
    record(f)
  }
  good(`${pending.length} migration${pending.length === 1 ? '' : 's'} applied`)
  return true
}

function deploy(dir) {
  step('Building and deploying...')
  const r = sh('npm run deploy', { cwd: dir })
  return r.ok
}

function useToken(token, accountId) {
  process.env.CLOUDFLARE_API_TOKEN = token
  if (accountId) process.env.CLOUDFLARE_ACCOUNT_ID = accountId
}

// ---- Cloudflare: login, then database + bucket + migrations + secret + deploy ----

/** Returns true when wrangler can talk to the account (already logged in, a token, or a fresh browser login). */
async function login() {
  if (process.env.CLOUDFLARE_API_TOKEN || sh('npx wrangler whoami', { silent: true }).out.includes('You are logged in')) { good('Already logged in to Cloudflare'); return true }
  header('Cloudflare')
  console.log(`  ${c(C.bold, '1')}. wrangler login  ${c(C.dim, '(browser, recommended)')}`)
  console.log(`  ${c(C.bold, '2')}. API token`)
  console.log(`  ${c(C.bold, '3')}. Skip  ${c(C.dim, '(work locally, deploy later)')}
`)
  const choice = await ask('Choose (1/2/3):')
  if (choice === '1') {
    const done = sh('npx wrangler login').ok
    if (done) good('Logged in'); else warn('Login failed. You can try again with: npx wrangler login')
    return done
  }
  if (choice === '2') {
    const accountId = await ask('Account ID:')
    const token = await ask('API token (needs Pages, D1 and R2 edit permissions):')
    if (token && accountId) { useToken(token, accountId); good('Using the API token for this run'); return true }
    warn('Both are needed. Skipping Cloudflare.')
  }
  return false
}

/** Puts the site online. Safe to run again: what exists is reused, migrations that ran are skipped. Returns true when deployed. */
function provision(dir, slug) {
  header('Cloudflare resources')
  const db = `${slug}-db`
  step(`Database ${db}`)
  const created = sh(`npx wrangler d1 create ${db}`, { cwd: dir, silent: true })
  let id = /database_id["\s:=]+"?([0-9a-f]{8}-[0-9a-f-]{27})/i.exec(created.out)?.[1]
  if (!id) {
    // it exists already: look its id up
    const info = sh(`npx wrangler d1 info ${db} --json`, { cwd: dir, silent: true })
    try { id = JSON.parse(info.out.slice(info.out.indexOf('{'))).uuid } catch { /* reported below */ }
  }
  if (!id) { fail(`Could not create or find the database:
    ${why(created.out)}`); return false }
  writeFileSync(join(webDir(dir), 'wrangler.toml'), wranglerToml({ slug, databaseId: id }))
  good(`Database ${db}`)

  step(`Media bucket ${slug}-media`)
  const bucket = sh(`npx wrangler r2 bucket create ${slug}-media`, { cwd: dir, silent: true })
  if (bucket.ok || /already exists/i.test(bucket.out)) good('Media bucket ready')
  else { fail(`Could not create the bucket (is R2 enabled on your account?):
    ${why(bucket.out)}`); return false }

  header('Database')
  if (!migrate(dir, db)) return false

  header('Site')
  step('Creating the Pages project...')
  const project = sh(`npx wrangler pages project create ${slug} --production-branch main`, { cwd: dir, silent: true })
  const projectExisted = !project.ok && /already exists/i.test(project.out)
  if (!project.ok && !projectExisted) { fail(`Could not create the Pages project:
    ${why(project.out)}`); return false }
  // a new random secret would sign everyone out of a site that is already running: only set it on a new project
  if (!projectExisted) {
    const secret = sh(`npx wrangler pages secret put JWT_SECRET --project-name ${slug}`, { cwd: dir, input: randomBytes(32).toString('hex') + '\n', silent: true })
    if (!secret.ok) { fail(`Could not set JWT_SECRET:
    ${why(secret.out)}
    Set it yourself: npx wrangler pages secret put JWT_SECRET --project-name ${slug}`); return false }
    good('Session secret set')
  }
  return deploy(dir)
}

/** web/wrangler.toml holds this site's database id: commit it, so a later `upgrade` finds a clean tree. */
function commitConfig(dir) {
  const git = args => sh(`git ${args}`, { cwd: dir, silent: true })
  if (!git('status --porcelain web/wrangler.toml').out.trim()) return
  const who = git('config user.email').out.trim() ? '' : '-c user.name=WordSvelte -c user.email=wordsvelte@localhost '
  git('add web/wrangler.toml')
  git(`${who}commit -q -m "Configure Cloudflare"`)
}

// ---- inside an existing site: upgrade / migrate ----

async function inSite(command) {
  const dir = process.cwd()
  const site = readSite(dir)
  if (!site) { fail('Run this inside a WordSvelte project (the directory that contains web/wrangler.toml).'); process.exit(1) }
  if (command === 'deploy') {
    if (!(await login())) process.exit(1)
    const live = provision(dir, site.slug)
    commitConfig(dir)
    if (live) console.log(`\n  ${c(C.green, 'Online.')} Open the address above, then ${c(C.bold, '/admin/setup')} if you have not created the administrator yet.\n`)
    process.exit(live ? 0 : 1)
  }
  const i = process.argv.indexOf('--applied')
  const alreadyApplied = i > 0 ? process.argv[i + 1] : undefined

  if (command === 'upgrade') {
    header('Upgrading')
    if (!existsSync(join(dir, '.git'))) { fail('This project has no git history to pull from. Re-clone it, or copy the new version over.'); process.exit(1) }
    const git = args => sh(`git ${args}`, { cwd: dir, silent: true })
    const remote = git('remote').out.split('\n').includes('upstream') ? 'upstream' : 'origin'
    step(`Fetching the latest version from ${remote}...`)
    const fetched = git(`fetch ${remote} main`)
    if (!fetched.ok) { fail(`Could not fetch:
    ${why(fetched.out)}`); process.exit(1) }

    if (!git('rev-parse --verify HEAD').ok) {
      // a project made by an early installer: git was started empty, so there is nothing to merge with
      warn('This project has no commits, so the new version cannot be merged into it.')
      if (!(await yes('Replace the project files with the latest version? Your Cloudflare settings (web/wrangler.toml) and local data are kept, but edits you made to the code are lost.'))) process.exit(1)
      const settings = readFileSync(join(webDir(dir), 'wrangler.toml'), 'utf8')
      git('update-ref refs/heads/main FETCH_HEAD')
      git('reset -q')
      git('checkout -- .')
      writeFileSync(join(webDir(dir), 'wrangler.toml'), settings)
      commitConfig(dir)
    } else {
      if (git('status --porcelain').out.trim()) { fail('You have uncommitted changes. Commit or stash them first, then run this again.'); process.exit(1) }
      step('Merging...')
      if (!sh(`git merge --no-edit FETCH_HEAD`, { cwd: dir }).ok) { fail('The merge has conflicts. Resolve them (git status), commit, and run this again.'); process.exit(1) }
    }
    step('Installing dependencies...')
    if (!sh('npm install', { cwd: dir, silent: true }).ok) warn('npm install had issues. Run "npm install" yourself if the build fails.')
  }
  header('Database')
  if (!migrate(dir, site.db, { alreadyApplied })) process.exit(1)
  if (command === 'upgrade') {
    header('Deploy')
    if (!deploy(dir)) { fail('Deploy failed. Run "npm run deploy" to see why.'); process.exit(1) }
    good('Deployed')
  }
}

// ---- a new site ----

async function create() {
  console.log(c(C.bold + C.cyan, '\n  WordSvelte') + c(C.dim, '  A news CMS that runs free on Cloudflare.\n'))

  header('Project')
  const projectName = (await ask(`Project directory (${c(C.dim, 'my-news')}):`)) || 'my-news'
  const dir = resolve(process.cwd(), projectName)
  if (existsSync(dir)) { fail(`Directory "${projectName}" already exists.`); process.exit(1) }
  const slug = slugOf(projectName)

  const online = await login()

  header('Scaffolding')
  step(`Cloning ${c(C.dim, REPO)}...`)
  const cloned = sh(`git clone ${REPO} "${dir}"`, { silent: true })
  if (!cloned.ok) { fail(`Could not clone the repository:\n    ${why(cloned.out)}`); process.exit(1) }
  // keep the history: the original stays as "upstream", which is where `npx wordsvelte upgrade` pulls from
  sh('git remote rename origin upstream', { cwd: dir, silent: true })
  writeFileSync(join(webDir(dir), 'wrangler.toml'), wranglerToml({ slug, databaseId: 'local-dev' }))
  commitConfig(dir)
  good('Project created')

  step('Installing dependencies (a minute or two)...')
  if (sh('npm install', { cwd: dir, silent: true }).ok) good('Dependencies installed')
  else warn('npm install had issues. Run "npm install" inside the project.')

  let live = false
  if (online && (await yes('Create the database and storage on Cloudflare and deploy now?'))) live = provision(dir, slug)
  commitConfig(dir)

  console.log(c(C.bold + C.green, '\n  Done.\n'))
  console.log(`  ${c(C.cyan, '1')}. cd ${c(C.bold, projectName)}`)
  if (live) {
    console.log(`  ${c(C.cyan, '2')}. Open the address wrangler printed above, then ${c(C.bold, '/admin/setup')} to create the first administrator.`)
    console.log(`  ${c(C.cyan, '3')}. Later: ${c(C.bold, 'npx wordsvelte upgrade')} pulls the new version, runs new migrations and deploys.`)
  } else {
    console.log(`  ${c(C.cyan, '2')}. ${c(C.bold, 'npm run dev')}  ->  ${c(C.underline, 'http://localhost:5173/admin/setup')}`)
    console.log(`  ${c(C.cyan, '3')}. To put it online later, run ${c(C.bold, 'npx wordsvelte deploy')} inside the project.`)
  }
  console.log(`\n  ${c(C.dim, 'Docs: https://github.com/mroyyan/wordsvelte')}\n`)
}

const command = process.argv[2]
if (command === 'upgrade' || command === 'migrate' || command === 'deploy') await inSite(command)
else if (!command || command === 'create') await create()
else { fail(`Unknown command "${command}". Use: npx wordsvelte [create | deploy | upgrade | migrate]`); process.exit(1) }
