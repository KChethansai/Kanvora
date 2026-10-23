// Gemini provider adapter for the Kanvora Assistant.
//
// The official @google/genai SDK is used server-side only. The adapter is
// created once at startup: without GEMINI_API_KEY it returns null, so no
// request can ever reach Google and the deterministic help fallback is served
// instead. Every call is bounded by a timeout and an output-token budget.
import { GoogleGenAI } from '@google/genai'
import { env } from '../config/env.js'

export const DEFAULT_TIMEOUT_MS = 15000
export const DEFAULT_MAX_OUTPUT_TOKENS = 600

// The client only ever sends user/assistant turns; the system instruction is
// authored here and can never be supplied by a caller.
const toContents = (messages) => messages.map((message) => ({
  role: message.role === 'assistant' ? 'model' : 'user',
  parts: [{ text: message.content }]
}))

export const createGeminiProvider = ({
  apiKey = env.geminiApiKey,
  model = env.geminiModel,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS
} = {}) => {
  if (typeof apiKey !== 'string' || !apiKey.trim()) return null
  const client = new GoogleGenAI({ apiKey })

  return {
    model,
    async reply({ system, messages, outputTokens = maxOutputTokens }) {
      const response = await client.models.generateContent({
        model,
        contents: toContents(messages),
        config: {
          systemInstruction: system,
          temperature: 0.3,
          maxOutputTokens: Math.min(outputTokens, maxOutputTokens),
          abortSignal: AbortSignal.timeout(timeoutMs),
          httpOptions: { timeout: timeoutMs }
        }
      })
      const text = typeof response.text === 'function' ? response.text() : response.text
      return text ?? ''
    }
  }
}

// A provider-shaped value that a test can pass to createApp. The real adapter is
// the only implementation that talks to Google.
export const isProvider = (value) => Boolean(value) &&
  typeof value === 'object' &&
  typeof value.reply === 'function' &&
  typeof value.model === 'string'
