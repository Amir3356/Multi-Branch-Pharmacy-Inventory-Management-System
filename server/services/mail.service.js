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
        // Fail in seconds, not nodemailer's default 2 minutes, when the mail server can't be reached
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      })

// The mail server couldn't be reached at all (offline, firewall, DNS), as opposed to a wrong password or address
const NETWORK_ERRORS = new Set(['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'EDNS', 'ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ENETUNREACH', 'EHOSTUNREACH', 'EAI_AGAIN'])
const isNetworkError = (error) => NETWORK_ERRORS.has(error?.code)

/** Renders a template and sends it (or logs it with MAIL_MAILER=log) */
export async function sendTemplate(template, to, data = {}) {
  const render = TEMPLATES[template]
  if (!render) throw new Error(`Unknown email template "${template}"`)
  const { subject, html, text } = render(data)

  if (!transport) {
    logger.info(`Email (MAIL_MAILER=log) to ${to}: ${subject}\n${text}`)
    return
  }
  try {
    await transport.sendMail({ from: { name: config.mail.fromName, address: config.mail.fromAddress }, to, subject, html, text })
  } catch (error) {
    // In development, no internet shouldn't block the work: print the email (with its link) to the console instead.
    // In production the error still surfaces, so nobody is told an email went out when it didn't.
    if (config.env !== 'production' && isNetworkError(error)) {
      logger.warn(`Mail server ${config.mail.host}:${config.mail.port} unreachable (${error.code}); email printed here instead of sent.\nTo: ${to}\nSubject: ${subject}\n${text}`)
      return
    }
    throw error
  }
}
