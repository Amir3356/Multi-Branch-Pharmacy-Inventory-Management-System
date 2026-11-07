import { createSlice } from '@reduxjs/toolkit'
import { STORAGE_KEYS, readJson } from '../../../utils'

// Which notifications this viewer has read or dismissed (kept in the browser)
const loadState = () => {
  const saved = readJson(STORAGE_KEYS.notifications)
  return { read: saved?.read || [], dismissed: saved?.dismissed || [] }
}

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: loadState,
  reducers: {
    readToggled(state, action) {
      const id = action.payload
      state.read = state.read.includes(id) ? state.read.filter((r) => r !== id) : [...state.read, id]
    },
    markedRead(state, action) {
      if (!state.read.includes(action.payload)) state.read.push(action.payload)
    },
    allMarkedRead(state, action) {
      state.read = [...new Set([...state.read, ...action.payload])]
    },
    dismissed(state, action) {
      state.dismissed.push(action.payload)
    },
    dismissedRestored(state, action) {
      state.dismissed = state.dismissed.filter((id) => !action.payload.includes(id))
    }
  }
})

export const { readToggled, markedRead, allMarkedRead, dismissed, dismissedRestored } = notificationsSlice.actions
export const selectNotificationState = (state) => state.notifications
export default notificationsSlice.reducer
