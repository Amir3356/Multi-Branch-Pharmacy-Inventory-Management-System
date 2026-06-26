import cron from 'node-cron'
import { runExclusive, logger } from '../config/index.js'

/**
 * Runs a background job on a cron schedule inside its service (replaces Laravel's scheduler). A run is skipped while
 * the previous one, on this or another instance, is still going (withoutOverlapping).
 *   schedule('*\/5 * * * *', 'expire-inactive-sessions', () => sessions.expireInactive())
 *   schedule('0 2 * * *', 'prune-old-sessions', prune, { timezone: config.timezone })
 */
export function schedule(expression, name, job, { timezone = 'UTC' } = {}) {
  if (!cron.validate(expression)) throw new Error(`Invalid cron expression for ${name}: ${expression}`)
  return cron.schedule(
    expression,
    async () => {
      try {
        const ran = await runExclusive(`job:${name}`, job)
        if (!ran) logger.info(`Job ${name} skipped: still running elsewhere`)
      } catch (error) {
        logger.error(`Job ${name} failed`, { error: error.message })
      }
    },
    { timezone },
  )
}

