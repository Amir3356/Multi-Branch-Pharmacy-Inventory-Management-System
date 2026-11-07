/** Laravel's DatabaseTokenRepository table: one row per email, holding the bcrypt hash of the emailed token */
export const TABLE = 'password_reset_tokens'

// Laravel's password broker settings (config/auth.php passwords.users): one reset email per account per minute
export const RESET_THROTTLE_SECONDS = 60
