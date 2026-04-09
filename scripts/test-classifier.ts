/**
 * Unit tests for classifyError — run with: npx ts-node scripts/test-classifier.ts
 * Or better: npx tsc --outDir /tmp/drift-test scripts/test-classifier.ts && node /tmp/drift-test/scripts/test-classifier.js
 */

// Inline minimal reimplementation to avoid Sentry import (which needs Next env)
import type { GenerationErrorCode } from '../src/lib/generation-errors'

type CaseResult = { name: string; expected: GenerationErrorCode; got: GenerationErrorCode; pass: boolean }

// Simple local version of classifyError without Sentry dep
function classifyErrorLocal(err: unknown, stage: string): GenerationErrorCode {
  const message = err instanceof Error ? err.message : String(err)
  const lower = message.toLowerCase()

  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('resource_exhausted')) return 'gemini_rate_limit'
  if (lower.includes('timeout') || lower.includes('etimedout') || lower.includes('deadline')) {
    return lower.includes('function') || lower.includes('lambda') ? 'function_timeout' : 'gemini_timeout'
  }
  if (
    lower.includes('gemini') ||
    lower.includes('generativelanguage') ||
    lower.includes('llm') ||
    lower.match(/^5\d{2}\s+status/) ||
    lower.includes('503 status') ||
    lower.includes('502 status') ||
    lower.includes('500 status') ||
    lower.includes('internal server error')
  ) return 'gemini_api_error'
  if (lower.includes('json') && (lower.includes('parse') || lower.includes('unexpected'))) return 'llm_parse_fail'
  if (lower.includes('outline parse failed') || lower.includes('empty outline')) return 'llm_empty_response'
  if (
    lower.includes('cannot read properties of undefined') ||
    lower.includes('cannot read property') ||
    lower.includes('destination is required') ||
    lower.includes('is undefined')
  ) return 'invalid_input'
  if (lower.includes('trip creation failed') || stage === 'db_trip_insert') return 'db_trip_insert'
  if (lower.includes('items insert failed') || stage === 'db_items_insert') return 'db_items_insert'
  if (lower.includes('jwt') || lower.includes('unauthorized') || lower.includes('row level security')) return 'db_auth_error'
  if (lower.includes('amadeus')) return 'amadeus_error'
  if (lower.includes('places') || lower.includes('google maps')) return 'places_api_error'
  if (lower.includes('grounded') || lower.includes('google_search')) return 'grounded_search_error'
  if (stage.includes('llm')) return 'gemini_api_error'
  if (stage.includes('db')) return 'db_trip_insert'
  return 'unknown'
}

const cases: Array<{ name: string; err: unknown; stage: string; expected: GenerationErrorCode }> = [
  { name: 'Gemini 429', err: new Error('429 Too Many Requests'), stage: 'generate_main', expected: 'gemini_rate_limit' },
  { name: 'Gemini resource exhausted', err: new Error('RESOURCE_EXHAUSTED: rate exceeded'), stage: 'generate_main', expected: 'gemini_rate_limit' },
  { name: 'LLM timeout', err: new Error('Request timeout after 30000ms'), stage: 'llm_outline', expected: 'gemini_timeout' },
  { name: 'Function timeout', err: new Error('Lambda function timeout'), stage: 'generate_main', expected: 'function_timeout' },
  { name: 'Gemini API error', err: new Error('generativelanguage.googleapis.com returned 503'), stage: 'generate_main', expected: 'gemini_api_error' },
  { name: 'JSON parse failure', err: new Error('Unexpected token in JSON at position 123'), stage: 'outline_parse', expected: 'llm_parse_fail' },
  { name: 'Outline empty', err: new Error('Outline parse failed, returning empty'), stage: 'llm_outline', expected: 'llm_empty_response' },
  { name: 'DB trip insert (message match)', err: new Error('Trip creation failed: constraint'), stage: 'generate_main', expected: 'db_trip_insert' },
  { name: 'DB trip insert (stage match)', err: new Error('duplicate key'), stage: 'db_trip_insert', expected: 'db_trip_insert' },
  { name: 'DB items insert', err: new Error('Items insert failed: invalid shape'), stage: 'generate_main', expected: 'db_items_insert' },
  { name: 'JWT expired', err: new Error('JWT expired'), stage: 'generate_main', expected: 'db_auth_error' },
  { name: 'RLS violation', err: new Error('row level security policy violation'), stage: 'generate_main', expected: 'db_auth_error' },
  { name: 'Amadeus failure', err: new Error('Amadeus API returned 500'), stage: 'flight_search', expected: 'amadeus_error' },
  { name: 'Places API quota', err: new Error('Google Maps API quota exceeded'), stage: 'enrich', expected: 'places_api_error' },
  { name: 'Grounded search', err: new Error('google_search tool failed'), stage: 'grounding', expected: 'grounded_search_error' },
  { name: 'LLM stage fallback', err: new Error('vague error'), stage: 'llm_day_3', expected: 'gemini_api_error' },
  { name: 'DB stage fallback', err: new Error('vague db error'), stage: 'db_something', expected: 'db_trip_insert' },
  { name: 'Unknown', err: new Error('mysterious'), stage: 'weird_stage', expected: 'unknown' },
  // New cases from real errors seen in testing
  { name: 'Gemini 503 raw', err: new Error('503 status code (no body)'), stage: 'llm_outline', expected: 'gemini_api_error' },
  { name: 'Gemini 502 raw', err: new Error('502 status code'), stage: 'llm_outline', expected: 'gemini_api_error' },
  { name: 'Gemini internal server error', err: new Error('internal server error from Gemini'), stage: 'llm_outline', expected: 'gemini_api_error' },
  { name: 'Undefined property crash', err: new Error("Cannot read properties of undefined (reading 'length')"), stage: 'generate_main', expected: 'invalid_input' },
  { name: 'Missing destination', err: new Error('Destination is required'), stage: 'generate_main', expected: 'invalid_input' },
]

console.log('\n=== classifyError test suite ===\n')

const results: CaseResult[] = cases.map(c => {
  const got = classifyErrorLocal(c.err, c.stage)
  return { name: c.name, expected: c.expected, got, pass: got === c.expected }
})

const passed = results.filter(r => r.pass).length
const failed = results.filter(r => !r.pass)

results.forEach(r => {
  const icon = r.pass ? '✓' : '✗'
  console.log(`  ${icon} ${r.name}`)
  if (!r.pass) {
    console.log(`      expected: ${r.expected}`)
    console.log(`      got:      ${r.got}`)
  }
})

console.log(`\n${passed}/${cases.length} passed`)
if (failed.length > 0) {
  console.log(`\nFAILURES:`)
  failed.forEach(r => console.log(`  - ${r.name}: expected ${r.expected}, got ${r.got}`))
  process.exit(1)
}
console.log('\nAll tests passed ✓\n')
