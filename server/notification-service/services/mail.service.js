import nodemailer from 'nodemailer'
import { TEMPLATES } from '../models/emailTemplate.model.js'
import { config, logger } from '../utils/index.js'

// MAIL_MAILER=log prints each email to the console instead of sending it (local development without SMTP)
// Pooled: the SMTP connection stays open and signed in between emails, so a send skips the connect, TLS and login
// round trips (and Gmail's slow greeting when it throttles new connections); it reconnects on its own when closed.
const transport =
  config.mail.mailer === 'log'
    ? null
    : nodemailer.createTransport({
        pool: true,
        maxConnections: 2,
        host: config.mail.host,
        port: config.mail.port,
        secure: config.mail.port === 465,
        auth: config.mail.username ? { user: config.mail.username, pass: config.mail.password } : undefined,
      })

/** Renders a template and sends it (or logs it with MAIL_MAILER=log) */
export async function sendTemplate(template, to, data = {}) {
  const render = TEMPLATES[template]
  if (!render) throw new Error(`Unknown email template "${template}"`)
  const { subject, html, text } = render(data)

  if (!transport) {
    logger.info(`Email (MAIL_MAILER=log) to ${to}: ${subject}\n${text}`)
    return
  }
  await transport.sendMail({ from: { name: config.mail.fromName, address: config.mail.fromAddress }, to, subject, html, text })
}
