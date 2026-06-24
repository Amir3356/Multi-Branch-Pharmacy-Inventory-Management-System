import { HttpError, limit } from '../utils/index.js'
import { isTruthy as truthy } from '../utils/helpers.js'

export const MAX_RECOMMENDATIONS = 8

const PRIORITIES = ['high', 'medium', 'low']

const isObject = (value) => value !== null && typeof value === 'object'
const values = (value) => (Array.isArray(value) ? value : Object.values(value))

const cleanText = (value) => (typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim())
const clean = (value, max) => limit(cleanText(isObject(value) ? '' : value), max)

/**
 * The AI's reply as { summary, recommendations }.
 */
export function parseRecommendations(reply) {
  const start = reply.indexOf('{')
  const end = reply.lastIndexOf('}')
  let data = null
  if (start !== -1 && end > start) {
    try {
      data = JSON.parse(reply.slice(start, end + 1))
    } catch {
      data = null
    }
  }
  if (!isObject(data) || !isObject(data.recommendations)) {
    throw new HttpError(502, 'The AI service answered in an unexpected format. Try again.')
  }

  const items = values(data.recommendations)
    .filter((r) => isObject(r) && cleanText(r.title ?? '') !== '')
    .slice(0, MAX_RECOMMENDATIONS)
    .map((r) => {
      const category = clean(r.category ?? 'General', 30)
      return {
        title: clean(r.title, 120),
        detail: clean(r.detail ?? '', 500),
        priority: PRIORITIES.includes(r.priority) ? r.priority : 'medium',
        category: truthy(category) ? category : 'General',
        action: clean(r.action ?? '', 120),
      }
    })

  return {
    summary: clean(data.summary ?? '', 300),
    recommendations: items,
  }
}
