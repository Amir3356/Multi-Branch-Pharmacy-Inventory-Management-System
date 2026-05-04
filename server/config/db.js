import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'
import { logger } from './logger.js'

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(serverRoot, '.env'), quiet: true })

// The database stores every timestamp in UTC (columns are `timestamp without time zone`, as Laravel created them).
// Send JS Dates as UTC, and read timestamps back as UTC, whatever the machine's time zone.
pg.defaults.parseInputDatesAsUTC = true
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (value) => (value === null ? null : new Date(`${value.replace(' ', 'T')}Z`)))
// Dates stay plain 'YYYY-MM-DD' strings: no time zone can shift them a day
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value)
// bigint ids and counts as numbers (ids never get near 2^53)
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => (value === null ? null : Number(value)))

export const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_DATABASE,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  // SQL's now() must write UTC like the JS side does. Without this it writes the database's own zone (e.g.
  // Africa/Addis_Ababa), which is then read back as UTC: 3 hours off, so a 10-minute invitation lasted 3h10m.
  options: '-c TimeZone=UTC',
})

pool.on('error', (error) => logger.error('Idle database client error', { error: error.message }))

/** Rows of a query */
export async function query(text, params = [], client = pool) {
  const result = await client.query(text, params)
  return result.rows
}

/** The first row of a query, or null */
export async function one(text, params = [], client = pool) {
  const result = await client.query(text, params)
  return result.rows[0] ?? null
}

/**
 * Runs fn(client) inside one transaction: committed if fn resolves, rolled back if it throws.
 * client.afterCommit(cb) queues work (broadcasts, emails) that runs only once the transaction has committed,
 * so a rolled-back change is never announced. Callbacks never break the request: their errors are logged.
 */
export async function transaction(fn) {
  const client = await pool.connect()
  const hooks = []
  client.inTransaction = true
  client.afterCommit = (callback) => hooks.push(callback)
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    for (const hook of hooks) {
      Promise.resolve()
        .then(hook)
        .catch((error) => logger.warn('After-commit task failed', { error: error.message }))
    }
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.inTransaction = false
    delete client.afterCommit
    client.release()
  }
}

/** Postgres unique_violation, optionally on one constraint/index name */
export function isUniqueViolation(error, constraint) {
  return error?.code === '23505' && (!constraint || error.constraint === constraint)
}

/**
 * Runs fn only if no other instance holds the named lock (Laravel's withoutOverlapping): used by scheduled jobs so
 * two copies of a service never run the same job at once. Returns false when skipped.
 */
export async function runExclusive(lockName, fn) {
  const client = await pool.connect()
  try {
    const { rows } = await client.query('select pg_try_advisory_lock(hashtext($1)) as locked', [lockName])
    if (!rows[0].locked) return false
    try {
      await fn()
      return true
    } finally {
      await client.query('select pg_advisory_unlock(hashtext($1))', [lockName])
    }
  } finally {
    client.release()
  }
}

export default pool
