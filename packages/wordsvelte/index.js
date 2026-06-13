#!/usr/bin/env node
import { createInterface } from 'node:readline'
import { execSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

const C = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', blue: '\x1b[34m', magenta: '\x1b[35m' }
const REPO = 'https://github.com/mroyyan/wordsvelte.git'

function c(color, text) { return `${color}${text}${C.reset}` }
function header(text) { console.log(`\n${c(C.bold + C.cyan, '◆')} ${c(C.bold, text)}`) }
function step(text) { console.log(`  ${c(C.dim, '○')} ${text}`) }
function ok(text) { console.log(`  ${c(C.green, '✔')} ${text}`) }
function warn(text) { console.log(`  ${c(C.yellow, '⚠')} ${text}`) }
function err(text) { console.log(`  ${c(C.red, '✖')} ${text}`) }
function nl() { console.log('') }

function ask(q) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question(`  ${c(C.dim, '?')} ${q} `, a => { rl.close(); resolve(a.trim()) })
  })
}

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { stdio: opts.silent ? 'pipe' : 'inherit', ...opts })
  } catch { return null }
}

function spawnWait(cmd, args) {
  return new Promise(resolve => {
    const p = spawn(cmd, args, { stdio: 'inherit', shell: true })
    p.on('close', code => resolve(code === 0))
  })
}

function hasCmd(cmd) {
  try { execSync(`where ${cmd}`, { stdio: 'pipe' }); return true } catch { return false }
}

// ---- MAIN ----

console.clear()
console.log(c(C.bold + C.cyan, `
  ┌────────────────────────────────────────┐
  │                                        │
  │   ██╗    ██╗ ██████╗ ██████╗ ██████╗   │
  │   ██║    ██║██╔═══██╗██╔══██╗██╔══██╗  │
  │   ██║ █╗ ██║██║   ██║██████╔╝██║  ██║  │
  │   ██║███╗██║██║   ██║██╔══██╗██║  ██║  │
  │   ╚███╔███╔╝╚██████╔╝██║  ██║██████╔╝  │
  │    ╚══╝╚══╝  ╚═════╝ ╚═╝  ╚═╝╚═════╝   │
  │                                        │
  │              News CMS                  │
  └────────────────────────────────────────┘
`))

console.log(c(C.dim, '  Deploy a full-featured news CMS to Cloudflare in minutes.\n'))

// ---- Step 1: Project name ----

header('Project Setup')

const defaultName = 'my-wordsvelte'
const projectName = (await ask(`Project directory (${c(C.dim, defaultName)}):`)) || defaultName
const projectPath = join(process.cwd(), projectName)

if (existsSync(projectPath)) {
  err(`Directory "${projectName}" already exists.`)
  process.exit(1)
}

const siteName = (await ask(`Site name (${c(C.dim, 'My News Site')}):`)) || 'My News Site'
ok(`Project: ${c(C.bold, projectName)} — "${siteName}"`)

// ---- Step 2: Cloudflare auth ----

header('Cloudflare Setup')
console.log(`  ${c(C.dim, 'Choose how to authenticate with Cloudflare:')}\n`)
console.log(`  ${c(C.bold, '1')}. ${c(C.cyan, 'wrangler login')}  — OAuth via browser (recommended)`)
console.log(`  ${c(C.bold, '2')}. API Token       — Enter Cloudflare API token manually`)
console.log(`  ${c(C.bold, '3')}. Skip            — Set up Cloudflare later\n`)

const authChoice = await ask('Choose (1/2/3):')
let cfToken = '', cfAccountId = ''

if (authChoice === '1') {
  step('Opening browser for Cloudflare login...')
  const ok = await spawnWait('npx', ['wrangler', 'login'])
  if (!ok) {
    warn('wrangler login failed. You can set up Cloudflare later with: npx wrangler login')
  } else {
    ok('Cloudflare logged in via OAuth')
  }
} else if (authChoice === '2') {
  cfAccountId = await ask('Cloudflare Account ID:')
  cfToken = await ask('Cloudflare API Token:')
  ok('API credentials saved')
} else {
  warn('Skipping Cloudflare setup — you can deploy later')
}

// ---- Step 3: Clone repo ----

header('Scaffolding')
step(`Cloning ${c(C.dim, REPO)}...`)

const gitOk = run(`git clone ${REPO} "${projectPath}"`, { silent: true })
if (!gitOk) {
  err('Failed to clone repository. Check your internet connection.')
  process.exit(1)
}

// Remove git history so user starts fresh
const gitDir = join(projectPath, '.git')
if (existsSync(gitDir)) {
  run(`rmdir /s /q "${gitDir}"`, { silent: true })
  run(`rm -rf "${gitDir}"`, { silent: true })
}

ok('Repository cloned')

// ---- Step 4: Write wrangler.toml ----

const isWin = process.platform === 'win32'
const migratePath = isWin ? 'web\\\\drizzle\\\\0000_far_pandemic.sql' : 'web/drizzle/0000_far_pandemic.sql'
// Generate a random JWT secret
const jwtSecret = randomBytes(32).toString('hex')

const wranglerContent = `name = "wordsvelte-web"
compatibility_date = "${new Date().toISOString().split('T')[0]}"
pages_build_output_dir = ".svelte-kit/cloudflare"

[[d1_databases]]
binding = "DB"
database_name = "wordsvelte-db"
database_id = "wordsvelte-db-prod"

[[r2_buckets]]
binding = "R2"
bucket_name = "wordsvelte-media"

# For production, set JWT_SECRET via: wrangler secret put JWT_SECRET
# In local dev, a random secret will be auto-generated and persisted in the DB.
`

writeFileSync(join(projectPath, 'web', 'wrangler.toml'), wranglerContent)
ok('wrangler.toml configured')

// ---- Step 5: npm install ----

step('Installing dependencies...')
const installOk = run('npm install', { cwd: projectPath, silent: true })
if (!installOk) {
  warn('npm install had issues. Run "npm install" manually.')
} else {
  ok('Dependencies installed')
}

// ---- Step 6: Setup D1 & R2 (if authenticated) ----

let dbCreated = false, r2Created = false, migrationApplied = false

if (authChoice === '1' || authChoice === '2') {
  header('Cloudflare Resources')
  const setupNow = (await ask('Create D1 database + R2 bucket now? (y/n):')).toLowerCase()

  if (setupNow === 'y' || setupNow === 'yes') {
    step('Creating D1 database...')
    const dbResult = run('npx wrangler d1 create wordsvelte-db', { silent: true })
    if (dbResult) { ok('D1 database: wordsvelte-db'); dbCreated = true }
    else { warn('D1 creation skipped (may already exist)') }

    step('Creating R2 bucket...')
    const r2Result = run('npx wrangler r2 bucket create wordsvelte-media', { silent: true })
    if (r2Result) { ok('R2 bucket: wordsvelte-media'); r2Created = true }
    else { warn('R2 creation skipped (may already exist)') }

    step('Applying database migration...')
    const migrateResult = run(`npx wrangler d1 execute wordsvelte-db --file=${migratePath}`, { cwd: projectPath, silent: true })
    if (migrateResult) { ok('Migration applied'); migrationApplied = true }
    else { warn('Migration failed — apply manually with: npx wrangler d1 execute wordsvelte-db --file=web/drizzle/0000_far_pandemic.sql') }

    step(`Generated JWT secret: ${c(C.yellow, jwtSecret)}  ${c(C.dim, '(save this!)')}`)
  }
}

// ---- Step 7: Success ----

console.log(c(C.bold + C.green, `
  ╔══════════════════════════════════════════╗
  ║          Setup Complete! 🎉              ║
  ╚══════════════════════════════════════════╝
`))

console.log(c(C.bold, '\n  Next steps:\n'))
console.log(`  ${c(C.cyan, '1')}. cd ${c(C.bold, projectName)}`)
console.log(`  ${c(C.cyan, '2')}. ${c(C.bold, 'npm run dev -w web')}`)
console.log(`     → Open ${c(C.underline, 'http://localhost:5173/admin')} to set up your first admin account`)

if (!dbCreated || !r2Created) {
  console.log(`\n  ${c(C.yellow, '⚠')}  Cloudflare resources need manual setup:`)
  console.log(`     ${c(C.dim, 'npx wrangler d1 create wordsvelte-db')}`)
  console.log(`     ${c(C.dim, 'npx wrangler r2 bucket create wordsvelte-media')}`)
  console.log(`     ${c(C.dim, 'npx wrangler d1 execute wordsvelte-db --file=web/drizzle/0000_far_pandemic.sql')}`)
}

console.log(`\n  ${c(C.cyan, '3')}. Deploy to Cloudflare:`)
console.log(`     ${c(C.dim, 'npx wrangler secret put JWT_SECRET')}`)
console.log(`     ${c(C.dim, 'npm run deploy -w web')}`)

console.log(`\n  ${c(C.dim, 'Docs: https://github.com/mroyyan/wordsvelte')}\n`)
