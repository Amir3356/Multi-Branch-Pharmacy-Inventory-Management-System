/** Password reset tokens: one row per email, holding the bcrypt hash of the emailed token */
export const TABLE = 'password_reset_tokens'

// One reset email per account per minute
export const RESET_THROTTLE_SECONDS = 60
