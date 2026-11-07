import pg from 'pg'
import { config } from './config.js'
import { logger } from './logger.js'

// The database stores every timestamp in UTC (columns are `timestamp without time zone`, as Laravel created them).
// Send JS Dates as UTC, and read timestamps back as UTC, whatever the machine's time zone.
pg.defaults.parseInputDatesAsUTC = true
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (value) => (value === null ? null : new Date(`${value.replace(' ', 'T')}Z`)))
// Dates stay plain 'YYYY-MM-DD' strings: no time zone can shift them a day
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value)
// bigint ids and counts as numbers (ids never get near 2^53)
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => (value === null ? null : Number(value)))
// numeric (money) stays a string, exactly as stored, e.g. "120.50"; convert where arithmetic is needed

export const pool = new pg.Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  // At most DB_POOL_SIZE connections from this service; keep the total of all services under Postgres's max_connections
  max: config.db.poolSize,
  // A query waiting longer than this for a free connection fails instead of hanging (0 = wait forever)
  connectionTimeoutMillis: config.db.connectionTimeoutMs,
  // Unused connections are closed after this long (0 = keep them open)
  idleTimeoutMillis: config.db.idleTimeoutMs,
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
