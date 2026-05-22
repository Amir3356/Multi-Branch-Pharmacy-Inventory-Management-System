import * as accountService from '../services/account.service.js'
import { presentAccountWithDetails } from '../models/account.model.js'

/** Account Provision (Laravel's AccountController): HTTP in, JSON out */

const respondWith = async (account) => presentAccountWithDetails(await accountService.findWithDetails(account.id))

export async function index(req, res) {
  const rows = await accountService.list()
  res.json({ data: rows.map(presentAccountWithDetails) })
}

export async function store(req, res) {
  const user = await accountService.create(req, req.body)
  res.status(201).json({
    message: `Invitation sent to ${user.email}. ${user.full_name} can sign in after setting a password.`,
    account: await respondWith(user),
  })
}

export async function update(req, res) {
  const message = await accountService.update(req, req.account, req.body)
  res.json({ message, account: await respondWith(req.account) })
}

export async function destroy(req, res) {
  const { account } = req
  await accountService.remove(req, account)
  res.json({ message: `${account.full_name}'s account was deleted.` })
}

export async function resendInvitation(req, res) {
  const { account } = req
  await accountService.resendInvitation(req, account)
  res.json({ message: `A new invitation was sent to ${account.email}.`, account: await respondWith(account) })
}
