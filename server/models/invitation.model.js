import { iso8601, roleLabel } from '../utils/index.js'

/**
 * Account invitation: a row of account_invitations (only the sha256 of the emailed token is stored) and the JSON the
 * invited person's page reads (Laravel's AccountInvitation model and InvitationController@show).
 */
/** GET /invitations/:token, for a row from invitationService.find (with its user and branch name) */
export function presentInvitation(invitation) {
  return {
    fullName: invitation.full_name,
    email: invitation.email,
    roleLabel: roleLabel(invitation.role),
    branchName: invitation.branch_name ?? null,
    expiresAt: iso8601(invitation.expires_at),
  }
}
