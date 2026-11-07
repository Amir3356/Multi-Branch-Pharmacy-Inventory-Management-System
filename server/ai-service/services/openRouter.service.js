import { HttpError, config } from '../utils/index.js'
import { truthy } from '../utils/php.js'

/**
 * OpenRouter's OpenAI-compatible chat completions (https://openrouter.ai/docs), with the same errors the Laravel
 * OpenRouterClient gave. Only the non-streaming chat() is ported: the AI routes never streamed.
 */

// PHP's trim(): the reply is trimmed of ASCII whitespace only, as before
const phpTrim = (text) => text.replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, '')

/** Whether OPENROUTER_API_KEY is set, so callers can hide AI features instead of failing */
export const isConfigured = () => Boolean(config.openrouter.apiKey)

/**
 * Sends a conversation and returns the assistant's whole reply text.
 * messages: [{ role: 'system' | 'user' | 'assistant', content }]; options go straight into the request
 * (temperature, response_format, ...).
 */
export async function chat(messages, options = {}) {
  const data = await send(payload(messages, options))
  const content = data?.choices?.[0]?.message?.content
  // (string) cast of the content: null → '', numbers and booleans as PHP printed them
  const text = content === null || content === undefined || content === false ? '' : content === true ? '1' : typeof content === 'object' ? 'Array' : String(content)
  // Some models open their reply with blank lines
  return phpTrim(text)
}

function payload(messages, options) {
  // The model thinks before answering unless OPENROUTER_REASONING=false (several times faster, less careful)
  const reasoning = config.openrouter.reasoning ? {} : { reasoning: { enabled: false } }
  return { model: config.openrouter.model, messages, ...reasoning, ...options }
}

async function send(body) {
  const key = config.openrouter.apiKey
  if (!key) throw new HttpError(503, 'AI Assistance is not configured. Set OPENROUTER_API_KEY in the server .env file.')

  let response
  let text
  try {
    response = await fetch(`${config.openrouter.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        // Optional: names this app in the OpenRouter dashboard and its app rankings
        'HTTP-Referer': config.frontendUrl,
        'X-Title': config.appName,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.openrouter.timeout * 1000),
    })
    text = await response.text()
  } catch {
    // Connection refused, DNS failure or the timeout: Laravel's ConnectionException
    throw new HttpError(502, "Can't reach the AI service right now. Try again in a moment.")
  }

  let data = null
  try {
    data = JSON.parse(text)
  } catch {
    data = null
  }

  if (response.status === 401 || response.status === 403) {
    throw new HttpError(503, 'The AI service rejected the API key. Check OPENROUTER_API_KEY in the server .env file.')
  }
  if (response.status === 402) {
    throw new HttpError(503, 'The OpenRouter account is out of credits. Add credits or switch OPENROUTER_MODEL to a free model.')
  }
  if (response.status === 429) throw new HttpError(429, 'The AI service is busy (rate limit reached). Try again in a moment.')
  if (response.status < 200 || response.status >= 300) {
    throw new HttpError(502, `The AI service could not answer: ${errorMessage(data, response.status)}`)
  }
  return data
}

// OpenRouter errors are { error: { code, message, metadata } }; for "Provider returned error" the reason is in metadata.raw
function errorMessage(data, status) {
  const raw = data?.error?.metadata?.raw
  let provider = null
  if (typeof raw === 'string') {
    try {
      const decoded = JSON.parse(raw)
      provider = decoded && typeof decoded === 'object' ? (decoded.message ?? null) : null
    } catch {
      provider = null
    }
  }
  if (truthy(provider)) return String(provider)
  const message = data?.error?.message
  if (truthy(message)) return String(message)
  return `unexpected response (${status}).`
}
