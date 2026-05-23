import { normalizeInput, rule, validateRules } from '../../utils/rules.js'

/**
 * POST /invitations/:token/accept (AcceptInvitationRequest): the form request validated before the controller looked
 * at the token. req.body becomes the normalized input (the password is not trimmed).
 */
export async function validateAcceptInvitation(req, res, next) {
  const input = normalizeInput(req.body)
  await validateRules(
    {
      // Any password is accepted; it only has to match the confirmation
      password: { rules: [rule.required(), rule.string(), rule.max(255), rule.confirmed()] },
    },
    input,
  )
  req.body = input
  next()
}
