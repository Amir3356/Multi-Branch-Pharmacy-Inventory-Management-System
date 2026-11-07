import { cleanInput } from '../utils/php.js'
import { answer, recommendations as recommendationsFor } from '../services/ai.service.js'

// $request->boolean(): FILTER_VALIDATE_BOOLEAN's true values
const isTrue = (value) => typeof value === 'string' && ['1', 'true', 'on', 'yes'].includes(value.toLowerCase())

/** GET /ai/recommendations?refresh=1: recommendations for the signed-in user's role */
export async function recommendations(req, res) {
  const refresh = isTrue(cleanInput(req.query.refresh))
  res.json({ data: await recommendationsFor(req.user, refresh) })
}

/** POST /ai/chat: answers the last question (req.validatedBody.messages) from the role's figures */
export async function chat(req, res) {
  res.json({ data: { reply: await answer(req.user, req.validatedBody.messages) } })
}
