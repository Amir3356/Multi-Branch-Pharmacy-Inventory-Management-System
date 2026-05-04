import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import dotenv from 'dotenv'
import { runner } from 'node-pg-migrate'

// Load environment variables from server root .env
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
dotenv.config({ path: path.join(serverRoot, '.env') })

const dbConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_DATABASE,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  // Same as config/db.js: SQL now() writes UTC
  options: "-c TimeZone=UTC",
}

async function fresh() {
  console.log(`🔄 Dropping and recreating public schema on database "${dbConfig.database}"...`)

  const client = new pg.Client(dbConfig)
  await client.connect()

  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE;')
    await client.query('CREATE SCHEMA public;')
    await client.query('GRANT ALL ON SCHEMA public TO public;')
    if (dbConfig.user) {
      await client.query(`GRANT ALL ON SCHEMA public TO "${dbConfig.user}";`)
    }
    console.log('✅ Public schema reset successfully.')

    console.log('🚀 Running all migrations via node-pg-migrate...')
    const actions = await runner({
      dbClient: client,
      dir: 'migrations',
      direction: 'up',
      migrationsTable: 'pgmigrations',
      count: Infinity,
    })
    console.log(`✨ Fresh migration complete! Applied ${actions.length} migrations.`)
  } finally {
    await client.end()
  }
}

fresh().catch((err) => {
  console.error('❌ fresh migration failed:', err.message)
  process.exit(1)
})
