// npm run migrate: creates or updates this service's own tables (migrations/*.sql). Docker runs it before starting.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool, runMigrations } from './utils/index.js'

try {
  await runMigrations('sales-service', path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations'))
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
