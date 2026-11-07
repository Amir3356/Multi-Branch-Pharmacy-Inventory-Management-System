import { HttpError, limit } from '../utils/index.js'
import { truthy } from '../utils/php.js'

export const MAX_RECOMMENDATIONS = 6

const PRIORITIES = ['high', 'medium', 'low']

// json_decode($json, true) turns JSON objects and arrays alike into PHP arrays
const isPhpArray = (value) => value !== null && typeof value === 'object'
const values = (value) => (Array.isArray(value) ? value : Object.values(value))

// PHP's (string) cast for what a model may put in a field
function phpString(value) {
  if (value === null || value === undefined || value === false) return ''
  if (value === true) return '1'
  if (typeof value === 'object') return 'Array'
  return String(value)
}

const phpTrim = (text) => text.replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, '')

// Str::limit(trim((string) (is_scalar($value) ? $value : '')), $limit)
const clean = (value, max) => limit(phpTrim(phpString(isPhpArray(value) ? '' : value)), max)

/**
 * The AI's reply as { summary, recommendations }. Models don't always honour the JSON format: accept a fenced or
 * wrapped object, and tidy every field.
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
  if (!isPhpArray(data) || !isPhpArray(data.recommendations)) {
    throw new HttpError(502, 'The AI service answered in an unexpected format. Try again.')
  }

  const items = values(data.recommendations)
    .filter((r) => isPhpArray(r) && phpTrim(phpString(r.title ?? '')) !== '')
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

  return { summary: clean(data.summary ?? '', 400), recommendations: items }
}
