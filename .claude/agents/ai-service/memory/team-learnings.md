# AI Service Team Learnings

## 2026-03-27 — Initial Prompt Rewrite

### Gemini 2.5 Flash Prompt Best Practices Applied
- Structured tags: `<role>/<task>/<constraints>/<output_format>/<example>`
- System/user split already works via OpenAI-compat → Gemini caches system instruction
- Added few-shot examples (GOOD + BAD) — biggest quality driver for Flash
- Explicit budget enforcement: "total MUST stay within 110%"
- Explicit filler ban with examples: "relax at hotel" = REJECTED

### Key Prompt Files
- `src/lib/ai-prompts.ts` — ALL prompts (generation, chat, destinations, URL extraction)
- `src/lib/ai-agent.ts` — LLM client, how prompts are sent (OpenAI-compat endpoint)
- `src/lib/ai-context.ts` — Context building for chat (trip summary, item context, catalog)
- `src/lib/ai-tools.ts` — 8 chat tools (search_catalog, swap_item, etc.)

### Model Config
- Gemini 2.5 Flash via OpenAI-compat: `generativelanguage.googleapis.com/v1beta/openai/`
- max_tokens: 16384 for generation
- Thinking tokens enabled by default
- 500ms throttle gap (2000 RPM Tier 1)

### Eval Insights (from quality team)
- placeValidity: 100/100 (zero hallucinations — our moat)
- ratingQuality: 56/100 (items lack ratings — post-generation enrichment issue)
- vibeMustHaves: 40/100 (LLM picks interesting but not vibe-essential places)
- Bangkok weakest (54), Istanbul/Colombo strongest (96-97)

### Known Issues
- "Relax at hotel" filler — banned in prompt, needs eval verification
- Budget not strictly enforced — prompt says 110% but no post-generation check
- Weather passed to LLM but not always reflected in activity selection
- Thinking tokens add ~200ms latency — acceptable trade-off for quality
