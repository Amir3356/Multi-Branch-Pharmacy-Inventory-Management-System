import { HttpError, config } from '../utils/index.js'

/**
 * Google Gemini (https://ai.google.dev): models.generateContent over REST. Non-streaming: the AI routes never stream.
 * The model is GEMINI_MODEL (a Gemini Pro model by default), authenticated with GEMINI_API_KEY.
 */

/**
 * Sends a conversation and returns the assistant's whole reply text.
 * messages: [{ role: 'system' | 'user' | 'assistant', content }].
 * options: { temperature?, json? } — json: true asks for a reply that is a single JSON object.
 */
export async function chat(messages, { temperature, json = false } = {}) {
  const data = await send(payload(messages, { temperature, json }))

  // A prompt Gemini refuses comes back with no candidates at all
  const blocked = data?.promptFeedback?.blockReason
  if (blocked) throw new HttpError(422, `The AI service declined this request (${blocked}). Rephrase the question and try again.`)

  const candidate = data?.candidates?.[0]
  if (!candidate) throw new HttpError(502, 'The AI service could not answer: unexpected response.')
  // Skip the model's thinking; only the answer parts are the reply
  const text = (candidate?.content?.parts ?? [])
    .filter((part) => typeof part.text === 'string' && !part.thought)
    .map((part) => part.text)
    .join('')
    .trim()

  if (!text) {
    const reason = candidate?.finishReason
    if (reason === 'MAX_TOKENS') throw new HttpError(502, 'The AI service ran out of room before it finished answering. Try a shorter question.')
    if (reason && reason !== 'STOP') throw new HttpError(422, `The AI service declined to answer (${reason}). Rephrase the question and try again.`)
  }
  return text
}

// OpenAI-style messages → Gemini's request: system messages become systemInstruction, assistant turns are role "model"
function payload(messages, { temperature, json }) {
  const system = messages.filter((m) => m.role === 'system').map((m) => String(m.content ?? ''))
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content ?? '') }] }))

  const generationConfig = {}
  if (temperature !== undefined) generationConfig.temperature = temperature
  if (json) generationConfig.responseMimeType = 'application/json'
  if (config.gemini.thinkingLevel) generationConfig.thinkingConfig = { thinkingLevel: config.gemini.thinkingLevel }

  return {
    ...(system.length ? { systemInstruction: { parts: [{ text: system.join('\n\n') }] } } : {}),
    contents,
    ...(Object.keys(generationConfig).length ? { generationConfig } : {}),
  }
}

// Google's model is sometimes briefly overloaded (503 UNAVAILABLE, "high demand") or hits an internal error (500):
// those are retried after these pauses. Bad keys, quotas and bad requests are never retried.
const RETRY_DELAYS_MS = [1500, 4000]
const isTransient = (status) => status === 500 || status === 503
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function send(body) {
  const key = config.gemini.apiKey
  if (!key) throw new HttpError(503, 'AI Assistance is not configured. Set GEMINI_API_KEY in the server .env file.')

  let result
  for (let attempt = 0; ; attempt++) {
    result = await sendOnce(body, key, config.gemini.model)
    if (result.ok || !isTransient(result.status) || attempt >= RETRY_DELAYS_MS.length) break
    await pause(RETRY_DELAYS_MS[attempt])
  }

  // Still overloaded after the retries, or its quota is used up (each model has its own free daily allowance):
  // answer with the lighter backup model (GEMINI_FALLBACK_MODEL) if one is set
  const fallback = config.gemini.fallbackModel
  if (!result.ok && (isTransient(result.status) || result.status === 429) && fallback && fallback !== config.gemini.model) {
    const backup = await sendOnce(body, key, fallback)
    if (backup.ok) return handle(backup)
  }
  return handle(result)
}

async function sendOnce(body, key, model) {
  let response
  let text
  try {
    response = await fetch(`${config.gemini.baseUrl}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.gemini.timeout * 1000),
    })
    text = await response.text()
  } catch {
    // Connection refused, DNS failure or the timeout
    throw new HttpError(502, "Can't reach the AI service right now. Try again in a moment.")
  }

  let data = null
  try {
    data = JSON.parse(text)
  } catch {
    data = null
  }
  return { ok: response.ok, status: response.status, data }
}

// The answer, or the error the Owner sees, from Gemini's response
function handle({ ok, status, data }) {
  if (ok) return data
  const response = { status }

  // Gemini errors are { error: { code, message, status, details } }
  const error = data?.error ?? {}
  const message = typeof error.message === 'string' && error.message ? error.message : `unexpected response (${response.status}).`
  const badKey = /api[_ ]key/i.test(message) || (error.details ?? []).some((d) => d?.reason === 'API_KEY_INVALID')

  if (response.status === 401 || response.status === 403 || (response.status === 400 && badKey)) {
    throw new HttpError(503, 'The AI service rejected the API key. Check GEMINI_API_KEY in the server .env file.')
  }
  if (response.status === 404) {
    throw new HttpError(503, `The AI model "${config.gemini.model}" isn't available. Check GEMINI_MODEL in the server .env file.`)
  }
  if (response.status === 429) throw quotaError(error)
  if (response.status === 503) {
    throw new HttpError(503, 'The AI model is overloaded right now (high demand at Google). Try again in a minute.')
  }
  throw new HttpError(502, `The AI service could not answer: ${message}`)
}

/**
 * Gemini's 429 covers two different things: a short per-minute rate limit (wait a moment), and a daily or plan
 * quota that is used up (or is zero, e.g. a Pro model on the free tier), which waiting a moment won't fix.
 */
function quotaError(error) {
  const details = Array.isArray(error.details) ? error.details : []
  const quotaIds = details.flatMap((d) => (Array.isArray(d?.violations) ? d.violations : [])).map((v) => String(v?.quotaId ?? ''))
  const retrySeconds = Number.parseFloat(details.find((d) => d?.retryDelay)?.retryDelay) || 0
  const daily = quotaIds.some((id) => /PerDay/i.test(id)) || retrySeconds > 3600

  if (daily) {
    const freeTier = quotaIds.some((id) => /FreeTier/i.test(id))
    return new HttpError(
      503,
      freeTier
        ? `The free Gemini plan has no quota left for ${config.gemini.model}. Turn on billing for your Google AI Studio project, or set GEMINI_MODEL to a model your plan includes.`
        : `The Gemini quota for ${config.gemini.model} is used up for today. Check your plan in Google AI Studio, or set GEMINI_MODEL to another model.`,
    )
  }
  const wait = retrySeconds ? ` Try again in ${Math.ceil(retrySeconds)} seconds.` : ' Try again in a moment.'
  return new HttpError(429, `The AI service is busy (rate limit reached).${wait}`)
}
