# Growth Team Learnings

## 2026-03-26 — Initial Setup

### Available Data
- 164 trips across 44 destinations
- 24 eval results, avg score 81/100
- Top destinations for content: Istanbul (96), Ireland (96), Colombo (97), Uluwatu (96)
- Avoid for content: Bangkok (54), Pondicherry (58) — low quality scores

### Infrastructure Status
- Resend API key: NOT CONFIGURED — email drafts only
- Reddit API: NOT CONFIGURED — manual posting for now
- Twitter API: NOT CONFIGURED — manual posting for now
- GA4 property: G-PXYBWQ53L9 (tracking active, no API access)
- Supabase: AVAILABLE — full read access via service role key
- Eval system: AVAILABLE — `/api/ai/eval/analysis` for quality data

### Content Created
- `growth/content/product-hunt-launch.md`
- `growth/content/reddit-posts.md`

### Key Insight
Zero hallucinations (placeValidity 100/100) is our strongest marketing claim. Every content piece should mention "every place verified on Google Maps."
