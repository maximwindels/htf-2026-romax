// Server-only. Picks the AI engine for every AI feature (triage, runbooks, the Oracle).
//
//   AI_PROVIDER=gemini   Google Gemini Flash   (needs GEMINI_API_KEY)
//   AI_PROVIDER=claude   Anthropic Claude      (needs ANTHROPIC_API_KEY)
//   AI_PROVIDER=rules    no AI, rules only
//   (not set)            Gemini if its key is set, else Claude if its key is set, else rules
//
// Whatever is chosen: when a call fails or times out, the feature falls back to its rules.
import type { z } from 'zod'
import { AI_MODEL as CLAUDE_MODEL, aiEnabled as claudeConfigured, askStructured as claudeStructured, askText as claudeText } from './claude'
import { geminiConfigured, geminiModel, geminiStructured, geminiText } from './gemini'

// Load .env from the project root (Node 22+ built-in). Missing file = fine.
try {
  process.loadEnvFile()
} catch {
  // no .env: keys can still come from the shell environment
}

export type Provider = 'gemini' | 'claude' | 'rules'

export function activeProvider(): Provider {
  const wanted = (process.env.AI_PROVIDER || '').toLowerCase()
  if (wanted === 'rules') return 'rules'
  if (wanted === 'gemini') return geminiConfigured() ? 'gemini' : 'rules'
  if (wanted === 'claude') return claudeConfigured() ? 'claude' : 'rules'
  if (geminiConfigured()) return 'gemini'
  if (claudeConfigured()) return 'claude'
  return 'rules'
}

export function aiEnabled() {
  return activeProvider() !== 'rules'
}

/** "Gemini · gemini-flash-latest", "Claude · claude-opus-5-5" or "rules". */
export function aiLabel() {
  const provider = activeProvider()
  if (provider === 'gemini') return `Gemini · ${geminiModel()}`
  if (provider === 'claude') return `Claude · ${CLAUDE_MODEL}`
  return 'rules'
}

type Effort = 'low' | 'medium' | 'high'

/** JSON matching `schema` from the active engine, or null (then the caller uses its rules). */
export async function askStructured<T extends z.ZodType>(schema: T, system: string, user: string, effort: Effort = 'low'): Promise<z.infer<T> | null> {
  const provider = activeProvider()
  if (provider === 'gemini') return geminiStructured(schema, system, user)
  if (provider === 'claude') return claudeStructured(schema, system, user, effort)
  return null
}

/** A plain-text answer from the active engine, or null. */
export async function askText(system: string, messages: { role: 'user' | 'assistant'; content: string }[], effort: Effort = 'low'): Promise<string | null> {
  const provider = activeProvider()
  if (provider === 'gemini') return geminiText(system, messages)
  if (provider === 'claude') return claudeText(system, messages, effort)
  return null
}
