// Runs before `npm run dev`. Frees the server port when it is held by a
// leftover instance of THIS server (e.g. a nodemon started in another
// terminal that was never stopped). Foreign processes are never killed.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const serverRoot = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'))
dotenv.config({ path: path.join(serverRoot, '.env'), quiet: true })

const port = Number(process.env.PORT) || Number(process.env.GATEWAY_PORT) || 7000

const run = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

const listeners = () =>
  run('lsof', ['-t', `-iTCP:${port}`, '-sTCP:LISTEN'])
    .split('\n')
    .map(Number)
    .filter(Boolean)

// The working directory of a process. On Linux it is read from /proc, which keeps unusual characters in the path
// (e.g. a newline in a folder name) exactly; lsof escapes them (a newline becomes the two characters "\n"), so its
// output is only a fallback (macOS) and is unescaped before use.
const cwdOf = (pid) => {
  try {
    return fs.realpathSync(fs.readlinkSync(`/proc/${pid}/cwd`))
  } catch {}
  const out = run('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'])
  const line = out.split('\n').find((l) => l.startsWith('n'))
  if (!line) return ''
  const unescaped = line.slice(1).replace(/\\(n|t|r|\\)/g, (_, c) => ({ n: '\n', t: '\t', r: '\r', '\\': '\\' })[c])
  try {
    return fs.realpathSync(unescaped)
  } catch {
    return unescaped
  }
}

const cmdOf = (pid) => run('ps', ['-o', 'command=', '-p', String(pid)])
const parentOf = (pid) => Number(run('ps', ['-o', 'ppid=', '-p', String(pid)])) || 0

const isAlive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Our own process and its parents (npm, the shell): never stopped
const ancestors = new Set()
for (let pid = process.pid; pid > 1 && !ancestors.has(pid); pid = parentOf(pid)) ancestors.add(pid)

const targets = new Set()

// 1. Every other nodemon (and its node child) running this server, even one whose app has crashed and holds no
//    port: left running, it restarts on every file change and fights the new instance for the port.
for (const line of run('ps', ['-eo', 'pid=,command=']).split('\n')) {
  const match = line.trim().match(/^(\d+)\s+(.*)$/)
  if (!match) continue
  const pid = Number(match[1])
  const command = match[2]
  if (ancestors.has(pid) || !/nodemon/.test(command) || !/server\.js/.test(command)) continue
  if (cwdOf(pid) !== serverRoot) continue
  targets.add(pid)
  for (const child of run('pgrep', ['-P', String(pid)]).split('\n').map(Number).filter(Boolean)) targets.add(child)
}

// 2. A Docker container publishing the port. Docker's port forwarder (docker-proxy) runs as root, so lsof cannot
//    see it and the port would otherwise look free. Containers with a restart policy come back on every reboot,
//    so say exactly which ones they are and how to stop them for good.
const dockerHolders = run('docker', ['ps', '--filter', `publish=${port}`, '--format', '{{.Names}}\t{{.Label "com.docker.compose.project.working_dir"}}'])
  .split('\n')
  .filter(Boolean)
  .map((line) => line.split('\t'))
if (dockerHolders.length) {
  console.error(`\n✖ Port ${port} is published by Docker container(s): ${dockerHolders.map(([name]) => name).join(', ')}`)
  for (const dir of new Set(dockerHolders.map(([, dir]) => dir).filter(Boolean))) {
    console.error(`  They belong to the compose project in ${dir}`)
    console.error(`  Stop them with:  (cd "${dir}" && docker compose stop)`)
  }
  console.error(`  Or stop individual containers with:  docker stop ${dockerHolders.map(([name]) => name).join(' ')}`)
  console.error(`  (Stopped containers stay stopped after a reboot.) Or set a different PORT in server/.env.\n`)
  process.exit(1)
}

// 3. Whatever is listening on the port
const pids = listeners()
if (pids.length === 0 && targets.size === 0) process.exit(0)

for (const pid of pids) {
  if (ancestors.has(pid) || targets.has(pid)) continue
  if (cwdOf(pid) !== serverRoot) {
    console.error(`\n✖ Port ${port} is used by another program (pid ${pid}): ${cmdOf(pid)}`)
    console.error(`  Stop it, or set a different PORT in server/.env.\n`)
    process.exit(1)
  }
  targets.add(pid)
  // Also stop the stale nodemon watching it, otherwise it would restart on the next file change.
  const parent = parentOf(pid)
  if (parent && /nodemon/.test(cmdOf(parent)) && cwdOf(parent) === serverRoot) targets.add(parent)
}

console.log(`Stopping a previous server instance still running (pid ${[...targets].join(', ')})...`)
for (const pid of targets) {
  try {
    process.kill(pid, 'SIGTERM')
  } catch {}
}

for (let i = 0; i < 30 && listeners().length; i++) await sleep(200)

if (listeners().length) {
  for (const pid of targets) if (isAlive(pid)) try { process.kill(pid, 'SIGKILL') } catch {}
  await sleep(300)
}

if (listeners().length) {
  console.error(`✖ Could not free port ${port}.`)
  process.exit(1)
}
console.log(`Port ${port} is free.`)
