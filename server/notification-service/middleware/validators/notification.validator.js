import { templateNames } from '../../models/emailTemplate.model.js'
import { z } from '../../utils/index.js'
import { validateBody } from '../validate.js'

// POST /internal/broadcast { channel, event, data }
export const validateBroadcast = validateBody(
  z.object({
    channel: z.string().min(1),
    event: z.string().min(1),
    data: z.record(z.string(), z.any()).default({}),
  }),
)

// POST /internal/email { template, to, data }
export const validateEmail = validateBody(
  z.object({
    template: z.enum(templateNames, { error: 'Unknown email template.' }),
    to: z.email({ error: 'The to field must be a valid email address.' }),
    data: z.record(z.string(), z.any()).default({}),
  }),
)
