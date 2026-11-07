import { config } from '../utils/index.js'

/**
 * The emails this service can send. Each template turns its data into { subject, html, text }, laid out like
 * Laravel's markdown mail: a heading, paragraphs, one button, more paragraphs, the app name.
 */

const escape = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

const paragraph = (html) => `<p style="margin:0 0 16px;line-height:1.5;color:#3d4852;">${html}</p>`

/**
 * The same simple message Laravel's markdown mail produced: a heading, paragraphs, one button, more paragraphs, the
 * app name. `before`/`after` items are HTML (escape any data inside them); returns { html, text }.
 */
function message({ heading, before, button, after }) {
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#edf2f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:570px;margin:0 auto;background:#fff;border-radius:4px;padding:32px;">
<h1 style="margin:0 0 16px;font-size:18px;color:#3d4852;">${escape(heading)}</h1>
${before.map(paragraph).join('\n')}
<p style="margin:24px 0;text-align:center;"><a href="${escape(button.url)}" style="background:#2d3748;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none;display:inline-block;">${escape(button.label)}</a></p>
${after.map(paragraph).join('\n')}
${paragraph(escape(config.appName))}
</div></body></html>`

  const plain = (fragment) =>
    fragment
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
  const text = [heading, ...before.map(plain), `${button.label}: ${button.url}`, ...after.map(plain), config.appName].join('\n\n')

  return { html, text }
}

/** Each template: data → { subject, html, text } */
export const TEMPLATES = {
  // data: { fullName, roleLabel, branchName?, link, expiresIn }
  invitation: (data) => ({
    subject: `You have been invited to ${config.appName}`,
    ...message({
      heading: `Welcome, ${data.fullName}`,
      before: [
        `The Owner has created a <strong>${escape(data.roleLabel)}</strong> account for you${data.branchName ? ` at ${escape(data.branchName)}` : ''}.`,
        'Click the button below to choose your password and open your dashboard.',
      ],
      button: { url: data.link, label: 'Set up my account' },
      after: [`This link expires in ${escape(data.expiresIn)}. If it has expired, ask the Owner to resend the invitation.`, "If you weren't expecting this email, you can ignore it."],
    }),
  }),

  // data: { fullName, link, expiresInMinutes }
  'reset-password': (data) => ({
    subject: `Reset your ${config.appName} password`,
    ...message({
      heading: 'Reset your password',
      before: [`Hi ${escape(data.fullName)}, we received a request to reset the password for your account.`],
      button: { url: data.link, label: 'Choose a new password' },
      after: [`This link expires in ${escape(data.expiresInMinutes)} minutes. If you didn't ask for a reset, you can ignore this email; your password won't change.`],
    }),
  }),
}

export const templateNames = Object.keys(TEMPLATES)
