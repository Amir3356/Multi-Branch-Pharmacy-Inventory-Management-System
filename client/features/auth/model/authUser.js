// The signed-in user and the auth payloads (server: Auth/Resources/AuthUserResource.php, Auth/Requests/*)

/**
 * @typedef {object} AuthUserExtras
 * @property {string[]} sections              the sections this role may open
 * @property {string} homeSection             where the user lands after sign-in
 * @property {number} sessionTimeoutMinutes   signed out after this long without use; 0 = never
 * @property {boolean} askDeviceLocation      ask the browser for its location after sign-in
 *
 * @typedef {import('../../accounts/model/account').Account & AuthUserExtras} AuthUser
 *
 * Returned by login, accepting an invitation and resetting a password
 * @typedef {{ token: string, user: AuthUser, message?: string }} AuthSession
 *
 * @typedef {{ email: string, password: string }} LoginPayload
 * @typedef {{ password: string, password_confirmation: string }} NewPasswordPayload
 * @typedef {NewPasswordPayload & { token: string, email: string }} ResetPasswordPayload
 */

/** @returns {NewPasswordPayload} the API expects Laravel's snake_case confirmation field */
export const toNewPasswordPayload = (password, passwordConfirmation) => ({ password, password_confirmation: passwordConfirmation })

/** @returns {ResetPasswordPayload} */
export const toResetPasswordPayload = ({ token, email, password, passwordConfirmation }) => ({ token, email, ...toNewPasswordPayload(password, passwordConfirmation) })
