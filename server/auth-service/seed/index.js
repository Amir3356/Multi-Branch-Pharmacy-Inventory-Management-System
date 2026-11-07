// npm run seed (auth-service): creates the initial Owner account (owner.js)
import { pool } from '../utils/index.js'
import { seedOwner } from './owner.js'

try {
  await seedOwner()
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
