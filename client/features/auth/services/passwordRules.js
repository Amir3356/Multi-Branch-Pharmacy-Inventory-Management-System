// Mirrors the API rule: any password, as long as the confirmation matches
export function validateNewPassword(password, confirmation) {
  const errors = {}
  if (!password) errors.password = 'Password is required'
  if (!confirmation) errors.password_confirmation = 'Confirm your password'
  else if (password && confirmation !== password) errors.password_confirmation = 'Passwords do not match'
  return errors
}
