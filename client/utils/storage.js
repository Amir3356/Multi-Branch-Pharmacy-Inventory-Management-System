// Browser storage for per-viewer preferences. Every read and write tolerates storage being unavailable.

export const STORAGE_KEYS = {
  settings: 'supermart-settings',
  notifications: 'supermart-notifications',
  auth: 'supermart-auth',
  // When this browser was last used (any tab), for the inactivity sign-out
  lastActivity: 'supermart-last-activity',
  // The session whose device location was already asked for, so the prompt shows once per sign-in
  locationAsked: 'supermart-location-asked'
}

export const readJson = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key))
  } catch {
    return null
  }
}

export const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable (e.g. private mode); the value still applies for this session
  }
}

export const readText = (key) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export const writeText = (key, value) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage unavailable; the value still applies for this session
  }
}
