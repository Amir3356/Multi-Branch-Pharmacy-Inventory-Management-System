import bcrypt from 'bcryptjs'

// Laravel hashed passwords with bcrypt ($2y$); $2y$ and $2b$ are the same algorithm, so existing passwords keep working
export async function hashPassword(plain) {
  return bcrypt.hash(String(plain), 12)
}

export async function verifyPassword(plain, hash) {
  if (!hash) return false
  return bcrypt.compare(String(plain), String(hash).replace(/^\$2y\$/, '$2b$'))
}
