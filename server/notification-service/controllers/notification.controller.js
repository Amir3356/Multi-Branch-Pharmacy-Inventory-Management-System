import { sendTemplate } from '../services/mail.service.js'
import { broadcast } from '../services/realtime.service.js'
import { HttpError, logger } from '../utils/index.js'

/** POST /internal/broadcast { channel, event, data } → { sent, listeners } */
export function sendBroadcast(req, res) {
  const { channel, event, data } = req.body
  res.json({ sent: true, listeners: broadcast(channel, event, data) })
}

/** POST /internal/email { template, to, data } → { sent }; 502 when the mail server refuses */
export async function sendEmail(req, res) {
  const { template, to, data } = req.body
  try {
    await sendTemplate(template, to, data)
  } catch (error) {
    logger.error('Email not sent', { template, to, error: error.message })
    throw new HttpError(502, 'The email could not be sent. Check the mail settings and try again.')
  }
  res.json({ sent: true })
}
