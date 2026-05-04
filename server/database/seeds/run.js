import { hashPassword } from '../../utils/passwords.js'
import { pool } from '../../config/db.js'

async function runSeeds() {
  console.log('🌱 Starting database seeding...')

  // 1. Seed Initial Owner Account (Credentials only)
  console.log('👤 Seeding default Owner account...')
  const ownerEmail = process.env.OWNER_EMAIL || 'amirsiraj1995@gmail.com'
  const ownerName = process.env.OWNER_NAME || 'Amir Siraj'
  const ownerPass = process.env.OWNER_PASSWORD || 'AEHJSS36'

  const { rowCount } = await pool.query("SELECT 1 FROM users WHERE role = 'owner'")
  if (rowCount) {
    console.log('ℹ️  Owner account already exists, keeping existing account.')
  } else {
    const passwordHash = await hashPassword(ownerPass)
    await pool.query(
      `INSERT INTO users (full_name, email, password, role, branch_id, status, email_verified_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'owner', null, 'active', now(), now(), now())`,
      [ownerName, ownerEmail, passwordHash],
    )
    console.log(`✅ Owner account created for ${ownerEmail}.`)
  }

  console.log('🎉 Seeding completed successfully!')
}

try {
  await runSeeds()
} catch (error) {
  console.error('❌ Seeding failed:', error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
