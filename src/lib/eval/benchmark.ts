// ─── Multi-LLM Benchmark ─────────────────────────────────────
// Generates itineraries from multiple LLM providers with identical prompts,
// then scores each with the same eval dimensions for fair comparison.

import OpenAI from 'openai'
import type { EvalItem, BenchmarkParams, LLMProvider } from './types'

// ─── Standardized Generation Prompt ──────────────────────────

function buildPrompt(p: BenchmarkParams): string {
  return `Plan a ${p.days}-day ${p.vibes.join(', ')} trip to ${p.destination}, ${p.country} for ${p.travelers} travelers on a ${p.budget} budget.

Return a JSON array of items:
[{"category":"day|hotel|activity|food","name":"Specific Real Place Name","price":"$XX","metadata":{"rating":4.5,"lat":0,"lng":0}}]

Requirements:
- Start with 1 hotel
- For each day: a "day" separator (e.g. {"category":"day","name":"Day 1","price":"","metadata":{}}), then 3-5 activities/restaurants
- Use REAL place names that exist on Google Maps
- Include realistic prices in USD
- Include GPS coordinates if you know them
- Include ratings if you know them
- ${p.vibes.join(', ')} vibes should be reflected in every pick

JSON only, no markdown, no explanation.`
}

function parseGeneratedItems(text: string): EvalItem[] {
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  const match = cleaned.match(/\[[\s\S]*\]/)
  if (!match) return []

  try {
    const items = JSON.parse(match[0]) as Array<{
      category?: string; name?: string; price?: string; metadata?: Record<string, unknown>
    }>
    return items.map(i => ({
      name: i.name || '',
      category: i.category || 'activity',
      price: i.price || '',
      metadata: i.metadata || {},
    }))
  } catch {
    return []
  }
}

// ─── Provider: Gemini Raw ────────────────────────────────────

function geminiRawProvider(): LLMProvider {
  const apiKey = process.env.GEMINI_API_KEY
  return {
    id: 'gemini-raw',
    name: 'Gemini 2.5 Flash (raw)',
    available: !!apiKey,
    generate: async (params) => {
      if (!apiKey) return []
      const client = new OpenAI({
        apiKey,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      })
      const res = await client.chat.completions.create({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: buildPrompt(params) }],
      })
      return parseGeneratedItems(res.choices[0]?.message?.content || '[]')
    },
  }
}

// ─── Provider: Groq (Llama 3.3 70B) ─────────────────────────

function groqProvider(): LLMProvider {
  const apiKey = process.env.GROQ_API_KEY
  return {
    id: 'groq-llama',
    name: 'Llama 3.3 70B (Groq)',
    available: !!apiKey,
    generate: async (params) => {
      if (!apiKey) return []
      const client = new OpenAI({
        apiKey,
        baseURL: 'https://api.groq.com/openai/v1',
      })
      const res = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: buildPrompt(params) }],
      })
      return parseGeneratedItems(res.choices[0]?.message?.content || '[]')
    },
  }
}

// ─── Provider: OpenAI GPT-4o ─────────────────────────────────

function openaiProvider(): LLMProvider {
  const apiKey = process.env.OPENAI_API_KEY
  return {
    id: 'gpt-4o',
    name: 'GPT-4o (OpenAI)',
    available: !!apiKey,
    generate: async (params) => {
      if (!apiKey) return []
      const client = new OpenAI({ apiKey })
      const res = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: buildPrompt(params) }],
      })
      return parseGeneratedItems(res.choices[0]?.message?.content || '[]')
    },
  }
}

// ─── Provider: Anthropic Claude ──────────────────────────────

function claudeProvider(): LLMProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY
  return {
    id: 'claude-sonnet',
    name: 'Claude Sonnet (Anthropic)',
    available: !!apiKey,
    generate: async (params) => {
      if (!apiKey) return []
      // Use Anthropic's OpenAI-compatible endpoint
      const client = new OpenAI({
        apiKey,
        baseURL: 'https://api.anthropic.com/v1/',
      })
      try {
        const res = await client.chat.completions.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          messages: [{ role: 'user', content: buildPrompt(params) }],
        })
        return parseGeneratedItems(res.choices[0]?.message?.content || '[]')
      } catch {
        // Fallback: use native Anthropic API
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            messages: [{ role: 'user', content: buildPrompt(params) }],
          }),
        })
        const data = await res.json()
        const text = data.content?.[0]?.text || '[]'
        return parseGeneratedItems(text)
      }
    },
  }
}

// ─── Provider Registry ───────────────────────────────────────

const ALL_PROVIDERS = [
  geminiRawProvider,
  groqProvider,
  openaiProvider,
  claudeProvider,
]

/**
 * Get all available providers (have API keys configured).
 */
export function getAvailableProviders(): LLMProvider[] {
  return ALL_PROVIDERS.map(fn => fn()).filter(p => p.available)
}

/**
 * Get specific providers by ID.
 */
export function getProviders(ids?: string[]): LLMProvider[] {
  const all = ALL_PROVIDERS.map(fn => fn())
  if (!ids || ids.length === 0) return all.filter(p => p.available)
  return all.filter(p => ids.includes(p.id) && p.available)
}

/**
 * Generate an itinerary from a specific provider.
 */
export async function generateFromProvider(
  provider: LLMProvider,
  params: BenchmarkParams,
): Promise<EvalItem[]> {
  try {
    return await provider.generate(params)
  } catch (err) {
    console.error(`[Benchmark] ${provider.id} failed:`, err)
    return []
  }
}
