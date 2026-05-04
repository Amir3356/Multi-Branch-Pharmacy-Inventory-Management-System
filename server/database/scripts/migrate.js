import { runner } from 'node-pg-migrate'
import { pool } from '../../config/db.js'

const direction = process.argv[2] === 'down' ? 'down' : 'up'

try {
  console.log(`🚀 Running migrations (${direction}) via node-pg-migrate...`)
  const actions = await runner({
    dbClient: pool,
    dir: 'migrations',
    direction,
    migrationsTable: 'pgmigrations',
    count: Infinity,
  })
  if (actions.length === 0) {
    console.log('✅ Database is already up to date.')
  } else {
    console.log(`✨ Applied ${actions.length} migration(s) successfully!`)
  }
} catch (error) {
  console.error('❌ Migration failed:', error.message)
  process.exit(1)
} finally {
  await pool.end()
}
