import { logger } from '../config/logger.js'
import * as realtimeService from '../services/realtime.service.js'
import * as auditLogService from '../services/auditLog.service.js'
import * as mailService from '../services/mail.service.js'

/**
 * Pushes a live update to every browser subscribed to a channel (Socket.IO).
 *   broadcast('branch.BR-01.sales', 'sale.recorded', { sale })
 * The client listens with realtime().private('branch.BR-01.sales').listen('.sale.recorded', handler).
 */
export function broadcast(channel, event, data = {}) {
  try {
    realtimeService.broadcast(channel, event, data)
  } catch (error) {
    logger.warn('Live update not sent', { channel, event, error: error.message })
  }
}

/**
 * Records an action in the audit log: who (the signed-in user, unless `actor` is given), from which
 * IP and device, on which branch, and what happened. Call it right after the action succeeds. Never throws.
 *
 *   audit(req, { module: 'Sales', action: 'Recorded sale', recordId: sale.id, description: '…', branchId })
 */
export function audit(req, {
  module,
  action,
  recordId = null,
  description,
  branchId = null,
  actor = null,
  actorName = null,
  branchName = null,
  type = null,
  before = null,
  after = null,
}) {
  const who = actor ?? req?.user ?? null
  auditLogService
    .record({
      module,
      action,
      recordId: recordId === null || recordId === undefined ? null : String(recordId),
      description,
      branchId,
      branchName,
      actor: who ? { id: who.id, fullName: who.fullName, role: who.role } : null,
      actorName,
      type,
      before: snapshot(before),
      after: snapshot(after),
      ip: req?.clientIp ?? null,
      userAgent: req?.userAgent ?? null,
    })
    .catch((error) => logger.error('Audit log not written', { module, action, recordId, error: error.message }))
}

/** A JSON-safe copy of a record (dates as ISO strings, numeric strings kept), or null */
function snapshot(value) {
  if (value === null || value === undefined) return null
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return null
  }
}

/**
 * Sends an email template through nodemailer. Resolves or rejects.
 *   await sendMail('invitation', 'someone@example.com', { fullName, roleLabel, branchName, link, expiresIn })
 *   await sendMail('reset-password', email, { fullName, link, expiresInMinutes })
 */
export function sendMail(template, to, data) {
  return mailService.sendTemplate(template, to, data)
}
