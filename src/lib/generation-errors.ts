/**
 * Generation error classification + structured reporting.
 *
 * When /api/ai/generate fails, we want to know EXACTLY what broke:
 * - Was it Gemini timing out?
 * - Did the LLM return unparseable JSON?
 * - Did the Supabase insert violate RLS?
 * - Did Amadeus hang?
 *
 * Generic "something failed" errors are useless for debugging.
 */

import * as Sentry from '@sentry/nextjs'

export type GenerationErrorCode =
  | 'gemini_timeout'         // LLM call took > timeout
  | 'gemini_rate_limit'      // 429 from Gemini
  | 'gemini_api_error'       // Other Gemini API failure
  | 'llm_parse_fail'         // LLM returned malformed JSON
  | 'llm_empty_response'     // LLM returned nothing usable
  | 'db_trip_insert'         // Supabase trip insert failed
  | 'db_items_insert'        // Supabase items insert failed
  | 'db_auth_error'          // Supabase auth check failed
  | 'amadeus_error'          // Flight search failed
  | 'places_api_error'       // Google Places API failed
  | 'grounded_search_error'  // Gemini + Google Search grounding failed
  | 'function_timeout'       // Vercel/Railway function hit 120s
  | 'invalid_input'          // Request body missing required fields
  | 'unknown'                // Unclassified

export interface GenerationError {
  code: GenerationErrorCode
  message: string
  stage: string             // Where in the pipeline it failed
  elapsed: number           // Seconds elapsed before failure
  context: Record<string, unknown>
}

/**
 * Inspect an error and classify it into one of our known codes.
 * Uses string matching on error messages because most underlying libraries
 * don't expose typed error classes.
 */
export function classifyError(err: unknown, stage: string, context: Record<string, unknown> = {}): GenerationError {
  // Supabase errors are plain objects with { message, code, details, hint }
  // Next.js fetch errors are Error instances
  // LLM SDK errors vary — handle all of them
  let message: string
  if (err instanceof Error) {
    message = err.message
  } else if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    message = (err as { message: string }).message
  } else {
    message = String(err)
  }
  const lower = message.toLowerCase()

  let code: GenerationErrorCode = 'unknown'

  // Gemini-specific errors
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('resource_exhausted')) {
    code = 'gemini_rate_limit'
  } else if (lower.includes('timeout') || lower.includes('etimedout') || lower.includes('deadline')) {
    code = lower.includes('function') || lower.includes('lambda') ? 'function_timeout' : 'gemini_timeout'
  } else if (
    lower.includes('gemini') ||
    lower.includes('generativelanguage') ||
    lower.includes('llm') ||
    // Gemini often returns raw HTTP status codes without useful messages
    lower.match(/^5\d{2}\s+status/) ||
    lower.includes('503 status') ||
    lower.includes('502 status') ||
    lower.includes('500 status') ||
    lower.includes('internal server error')
  ) {
    code = 'gemini_api_error'
  }
  // JSON parse errors
  else if (lower.includes('json') && (lower.includes('parse') || lower.includes('unexpected'))) {
    code = 'llm_parse_fail'
  } else if (lower.includes('outline parse failed') || lower.includes('empty outline')) {
    code = 'llm_empty_response'
  }
  // Missing input — often caused by empty destination/vibes crashing downstream
  else if (
    lower.includes('cannot read properties of undefined') ||
    lower.includes('cannot read property') ||
    lower.includes('destination is required') ||
    lower.includes('is undefined')
  ) {
    code = 'invalid_input'
  }
  // Supabase errors
  else if (lower.includes('trip creation failed') || stage === 'db_trip_insert') {
    code = 'db_trip_insert'
  } else if (lower.includes('items insert failed') || stage === 'db_items_insert') {
    code = 'db_items_insert'
  } else if (lower.includes('jwt') || lower.includes('unauthorized') || lower.includes('row level security')) {
    code = 'db_auth_error'
  }
  // External APIs
  else if (lower.includes('amadeus')) {
    code = 'amadeus_error'
  } else if (lower.includes('places') || lower.includes('google maps')) {
    code = 'places_api_error'
  } else if (lower.includes('grounded') || lower.includes('google_search')) {
    code = 'grounded_search_error'
  }
  // Stage-based fallbacks (when message is vague but stage is known)
  else if (stage.includes('llm')) {
    code = 'gemini_api_error'
  } else if (stage.includes('db')) {
    code = 'db_trip_insert'
  }

  return {
    code,
    message,
    stage,
    elapsed: (context.elapsed as number) || 0,
    context,
  }
}

/**
 * Report a classified generation failure to Sentry + console.
 * Includes full context so we can debug from the Sentry dashboard alone.
 */
export function reportGenerationFailure(genError: GenerationError, originalError: unknown) {
  const { code, message, stage, elapsed, context } = genError

  // Structured console log (shows up in Railway/Vercel logs)
  console.error(`[Generate] ❌ FAILED code=${code} stage=${stage} elapsed=${elapsed}s`)
  console.error(`[Generate] message: ${message}`)
  console.error(`[Generate] context:`, JSON.stringify(context, null, 2))
  if (originalError instanceof Error && originalError.stack) {
    console.error(`[Generate] stack: ${originalError.stack}`)
  }

  // Send to Sentry with rich context
  try {
    Sentry.withScope((scope) => {
      scope.setTag('generation_error_code', code)
      scope.setTag('generation_stage', stage)
      scope.setLevel(code === 'invalid_input' ? 'warning' : 'error')
      scope.setContext('generation', {
        code,
        stage,
        elapsed_seconds: elapsed,
        ...context,
      })
      scope.setFingerprint(['generation-failure', code, stage])

      if (originalError instanceof Error) {
        Sentry.captureException(originalError)
      } else {
        Sentry.captureMessage(`Generation failed: ${message}`, 'error')
      }
    })
  } catch (sentryErr) {
    console.warn('[Generate] Sentry report failed:', sentryErr)
  }
}

/**
 * Map an error code to a user-friendly message.
 * Users see a friendly version; devs see the code for debugging.
 */
export function getUserMessage(code: GenerationErrorCode): string {
  const messages: Record<GenerationErrorCode, string> = {
    gemini_timeout: 'The AI took too long to respond. Please try again.',
    gemini_rate_limit: 'We\'re experiencing high demand. Please wait a minute and try again.',
    gemini_api_error: 'The AI service is temporarily unavailable. Please try again in a moment.',
    llm_parse_fail: 'We had trouble building your itinerary. Please try again.',
    llm_empty_response: 'We couldn\'t generate a trip for this destination. Try different vibes or a different city.',
    db_trip_insert: 'Couldn\'t save your trip. Please try again.',
    db_items_insert: 'Couldn\'t save your itinerary details. Please try again.',
    db_auth_error: 'Your session expired. Please sign in again.',
    amadeus_error: 'Flight search is temporarily unavailable. Your itinerary will still be created.',
    places_api_error: 'Couldn\'t fetch place details. Please try again.',
    grounded_search_error: 'Location search failed. Please try again.',
    function_timeout: 'Generation is taking longer than expected. Please try again.',
    invalid_input: 'Some trip details are missing. Please go back and check.',
    unknown: 'Something went wrong. Please try again.',
  }
  return messages[code] || messages.unknown
}
