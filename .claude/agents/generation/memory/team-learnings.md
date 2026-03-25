# Generation Team Learnings

## 2026-03-26 — Initial Assessment

### Current State
- Generation uses Gemini 2.5 Flash via OpenAI-compat endpoint
- LLM-first generation with catalog as context (not template-first)
- Post-generation enrichment via Google Places (applyPlaceData)
- Streaming enabled, Google Search grounding enabled

### Key Issues from Evals
- ratingQuality: 56/100 — items not getting enriched with Places ratings
- landmarkCoverage: 40/100 — LLM picks interesting but not iconic places
- vibeMustHaves: 40/100 — doesn't prioritize best-for-vibe experiences
- dayBalance: 73/100 — some days overloaded, others sparse

### Files to Know
- `src/app/api/ai/generate/route.ts` — main generation pipeline
- `src/lib/ai-prompts.ts` — all system prompts
- `src/lib/ai-agent.ts` — LLM client + helpers
- `src/lib/google-places-photos.ts` — Places enrichment
- `src/lib/eval/scorer.ts` — how quality is scored
