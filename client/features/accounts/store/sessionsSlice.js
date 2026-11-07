import { createSlice } from '@reduxjs/toolkit'
import { minutesBetween } from '../../../utils'

/** Active while used in the last `idleAfterMinutes`, then Idle; ended sessions stay Ended */
export const sessionState = (session, now, idleAfterMinutes = 15) => {
  if (!session || session.status === 'Ended' || session.endedAt) return 'Ended'
  const lastActive = session.lastActiveAt || session.signedInAt
  if (!lastActive) return 'Active'
  return minutesBetween(now, lastActive) > (idleAfterMinutes || 15) ? 'Idle' : 'Active'
}

// Signed-in sessions across all staff, from the API (Owner only). Times are timestamps (ms).
// idleAfterMinutes comes from the server (SESSION_IDLE_MINUTES in server/.env).
const sessionsSlice = createSlice({
  name: 'sessions',
  initialState: { items: [], idleAfterMinutes: 15, signOutAfterMinutes: 30 },
  reducers: {
    sessionsLoaded(state, action) {
      state.items = action.payload.items
      state.idleAfterMinutes = action.payload.idleAfterMinutes
      state.signOutAfterMinutes = action.payload.signOutAfterMinutes
    },
    sessionSaved(state, action) {
      const index = state.items.findIndex((s) => s.id === action.payload.id)
      if (index !== -1) state.items[index] = action.payload
    },
    sessionRemoved(state, action) {
      state.items = state.items.filter((s) => s.id !== action.payload)
    }
  }
})

export const { sessionsLoaded, sessionSaved, sessionRemoved } = sessionsSlice.actions
export const selectSessions = (state) => state.sessions.items
export const selectIdleAfterMinutes = (state) => state.sessions.idleAfterMinutes
export const selectSignOutAfterMinutes = (state) => state.sessions.signOutAfterMinutes
export default sessionsSlice.reducer
