// npm run create-owner (Laravel's `php artisan owner:create`): the Owner isn't invited by anyone, so the first
// account is created here. It then provisions every staff account from the web app.
import readline from 'node:readline/promises'
import { ACCOUNT_STATUSES, ROLES, hashPassword, pool, transaction } from '../utils/index.js'
import * as users from '../repositories/user.repository.js'
import { rule } from '../utils/rules.js'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) })
// Ctrl+C at a prompt cancels (readline would otherwise just pause)
rl.on('SIGINT', () => {
  process.stdout.write('\n')
  process.exit(130)
})

// Hides what is typed at the password prompt (Laravel Prompts' password()); only line breaks are echoed
let muted = false
const writeToOutput = rl._writeToOutput?.bind(rl)
if (writeToOutput) {
  rl._writeToOutput = (text) => {
    if (!muted) return writeToOutput(text)
    if (/[\r\n]/.test(text)) writeToOutput('\n')
  }
}

/** Asks until the answer passes: required, then validate(answer) → error message or null */
async function ask(label, { hidden = false, validate = async () => null } = {}) {
  for (;;) {
    const pending = rl.question(`${label}: `)
    muted = hidden
    const answer = hidden ? await pending : (await pending).trim()
    muted = false
    const error = answer === '' ? 'Required.' : await validate(answer)
    if (!error) return answer
    console.error(`  ⚠ ${error}`)
  }
}

const emailRule = rule.email()

async function main() {
  if (await users.ownerExists()) {
    console.error('An Owner account already exists.')
    return 1
  }

  const fullName = await ask('Full name')
  // email:rfc|unique:users,email; every address is stored lower-case, so that is what's compared
  const email = (
    await ask('Email', {
      validate: async (value) => {
        if (!emailRule.test(value)) return 'The email field must be a valid email address.'
        if (await users.emailTaken(value.toLowerCase())) return 'The email has already been taken.'
        return null
      },
    })
  ).toLowerCase()
  const password = await ask('Password', { hidden: true })

  const passwordHash = await hashPassword(password)
  await transaction((client) =>
    users.create(client, {
      fullName,
      email,
      password: passwordHash,
      role: ROLES.OWNER,
      branchId: null,
      status: ACCOUNT_STATUSES.ACTIVE,
      emailVerified: true,
    }),
  )

  console.log(`Owner account created for ${email}. Sign in from the web app.`)
  return 0
}

try {
  process.exitCode = await main()
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  rl.close()
  await pool.end()
}
