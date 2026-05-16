import { acceptInvitationRequest, fetchCurrentUser, fetchInvitationByToken, forgotPassword, login, logout, resetPasswordRequest } from '../../../api/authApi'
import { loggedIn, loggedOut, sessionEnded, userRefreshed } from './authSlice'

// Each thunk returns the signed-in user, or throws ApiError for the page to show

export const signIn = (email, password) => async (dispatch) => {
  const session = await login(email, password)
  dispatch(loggedIn(session))
  return session.user
}

export const fetchInvitation = (token) => () => fetchInvitationByToken(token)

// Sets the password from the invitation link and signs the new user straight in
export const acceptInvitation = (token, password, passwordConfirmation) => async (dispatch, getState) => {
  const session = await acceptInvitationRequest(token, password, passwordConfirmation)
  return startSession(session, dispatch, getState)
}

// After accepting an invitation or resetting a password: sign in and return the user
const startSession = async (session, dispatch, getState) => {
  // Someone else was signed in on this browser: end their session first
  if (getState().auth.token) await logout().catch(() => {})
  dispatch(loggedIn(session))
  return session.user
}

export const requestPasswordReset = (email) => () => forgotPassword(email)

// Sets the new password and signs straight in (every old session is signed out by the server)
export const resetPassword = ({ token, email, password, passwordConfirmation }) => async (dispatch, getState) => {
  const session = await resetPasswordRequest({ token, email, password, passwordConfirmation })
  return startSession(session, dispatch, getState)
}

export const refreshCurrentUser = () => async (dispatch) => {
  const { data } = await fetchCurrentUser()
  dispatch(userRefreshed(data))
  return data
}

// The browser wasn't used for the session timeout: end the session on the server, then show why
export const signOutAfterInactivity = () => async (dispatch) => {
  await logout({ reason: 'inactivity' }).catch(() => {})
  dispatch(sessionEnded('Signed out after inactivity'))
}

export const signOut = () => async (dispatch) => {
  try {
    await logout()
  } catch {
    // Already signed out on the server (expired token); clear this browser anyway
  }
  dispatch(loggedOut())
}
