import * as invitationService from '../services/invitation.service.js'
import { presentInvitation } from '../models/invitation.model.js'

/** Public invitation pages (Laravel's InvitationController): HTTP in, JSON out */

export async function show(req, res) {
  const invitation = await invitationService.usable(req.params.token)
  res.json(presentInvitation(invitation))
}

/** Sets the password and signs the person straight in: the body is exactly a successful login's ({ token, user }) */
export async function accept(req, res) {
  res.json(await invitationService.acceptAndSignIn(req, req.params.token, req.body.password))
}
