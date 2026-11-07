import fs from 'node:fs/promises'
import path from 'node:path'
import { pool } from './db.js'

/**
 * Applies this service's migrations/*.sql files once each, in name order, recorded per service in service_migrations.
 * Every service shares one database, so a global advisory lock makes services that start together migrate one at a
 * time. The files are written IF NOT EXISTS, so they also run safely against the database the Laravel app created.
 */
export async function runMigrations(service, dir) {
  const client = await pool.connect()
  try {
    await client.query("select pg_advisory_lock(hashtext('supermart:migrations'))")
    await client.query(`create table if not exists service_migrations (
      service varchar(60) not null,
      name varchar(255) not null,
      applied_at timestamp(0) not null default now(),
      primary key (service, name)
    )`)
    const applied = new Set((await client.query('select name from service_migrations where service = $1', [service])).rows.map((row) => row.name))
    const files = (await fs.readdir(dir).catch(() => [])).filter((file) => file.endsWith('.sql')).sort()

    let ran = 0
    for (const file of files) {
      if (applied.has(file)) continue
      const sql = await fs.readFile(path.join(dir, file), 'utf8')
      try {
        await client.query('begin')
        await client.query(sql)
        await client.query('insert into service_migrations (service, name) values ($1, $2)', [service, file])
        await client.query('commit')
        console.log(`${service}: migrated ${file}`)
        ran++
      } catch (error) {
        await client.query('rollback')
        throw new Error(`${service}: ${file} failed: ${error.message}`)
      }
    }
    if (!ran) console.log(`${service}: nothing to migrate`)
  } finally {
    await client.query("select pg_advisory_unlock(hashtext('supermart:migrations'))").catch(() => {})
    client.release()
  }
}
