import { iso8601 } from '../utils/index.js'
import { recommendationCache as cache } from '../utils/recommendationCache.js'
import { brief, chatRules, recommendationRules } from '../utils/templates/aiPrompts.js'
import { parseRecommendations } from '../models/recommendation.model.js'
import { chat as askAi } from './gemini.service.js'
import { snapshotFor } from './roleSnapshot.service.js'

/**
 * AI Assistance (the Owner's only): recommendations and a chat that answer from the business's figures for the period
 * and branch the Owner chooses.
 */

/** Recommendations are kept this long per user, so opening the page doesn't call the AI every time */
const CACHE_MINUTES = 30

/**
 * { summary, recommendations: [{ title, detail, priority, category, action }], scope (the period and branch analysed),
 * flags (audit events the system flagged, straight from the data), generatedAt, cached }.
 * scope: { from, to, branchId } (see snapshotFor).
 */
export async function recommendations(user, refresh = false, scope = null) {
  const key = `ai:recommendations:${user.id}:${scope ? `${scope.from}:${scope.to}:${scope.branchId ?? 'all'}` : 'default'}`
  const hit = cache.get(key)
  if (hit && hit.expiresAt <= Date.now()) cache.delete(key)
  if (!refresh && hit && hit.expiresAt > Date.now()) return { ...hit.value, cached: true }

  const snapshot = await snapshotFor(user, scope)
  const reply = await askAi(
    [
      { role: 'system', content: `${brief()}\n\n${recommendationRules()}` },
      { role: 'user', content: `Today's figures (JSON):\n${JSON.stringify(snapshot, null, 2)}` },
    ],
    // JSON mode (not a strict schema): the shape is spelled out in the rules
    { json: true, temperature: 0.3 },
  )

  const result = {
    ...parseRecommendations(reply),
    scope: { ...snapshot.period, label: snapshot.scope },
    flags: snapshot.auditTrail.flags,
    flagCount: snapshot.auditTrail.flagCount,
    generatedAt: iso8601(new Date()),
  }
  cache.set(key, { value: result, expiresAt: Date.now() + CACHE_MINUTES * 60_000 })
  return { ...result, cached: false }
}

/**
 * Answers the latest question in a conversation of [{ role: user|assistant, content }], from the role's figures.
 * scope: { from, to, branchId } (see snapshotFor).
 */
export async function answer(user, messages, scope = null) {
  const snapshot = await snapshotFor(user, scope)
  const system = `${brief()}\n\n${chatRules()}\n\nThe figures you can use (JSON):\n${JSON.stringify(snapshot)}`
  const reply = await askAi([{ role: 'system', content: system }, ...messages], { temperature: 0.4 })
  return reply !== '' ? reply : "I couldn't come up with an answer. Try asking in a different way."
}
