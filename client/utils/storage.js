// Browser storage for per-viewer preferences. Every read and write tolerates storage being unavailable.

export const STORAGE_KEYS = {
  settings: 'pharmacy-ims-settings',
  notifications: 'pharmacy-ims-notifications',
  auth: 'pharmacy-ims-auth',
  // When this browser was last used (any tab), for the inactivity sign-out
  lastActivity: 'pharmacy-ims-last-activity',
  // The session whose device location was already asked for, so the prompt shows once per sign-in
  locationAsked: 'pharmacy-ims-location-asked'
}

// Values saved under the keys' old names move to the new ones once, so nobody is signed out and saved settings stay
const OLD_PREFIX = 'supermart-'
try {
  for (const key of Object.values(STORAGE_KEYS)) {
    const oldKey = OLD_PREFIX + key.slice('pharmacy-ims-'.length)
    const oldValue = localStorage.getItem(oldKey)
    if (oldValue !== null) {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, oldValue)
      localStorage.removeItem(oldKey)
    }
  }
} catch {
  // Storage unavailable; nothing to move
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
