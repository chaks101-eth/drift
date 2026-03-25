# Quality Team Learnings

## 2026-03-26 — Initial Eval Run (24 evals, 13 destinations)

### Key Findings
- Overall avg: 81/100
- **ratingQuality** systemically weak at 56/100 — items lack Google Places ratings
- **landmarkCoverage** weak at 73/100 (now split from must-see)
- **placeValidity** perfect at 100/100 — zero hallucinated places (Drift's moat)
- Bangkok (54) and Pondicherry (58) are weakest destinations
- Top performers: Istanbul (96), Ireland (96), Colombo (97)

### Metric Split (2026-03-26)
- Split `mustSeeCoverage` into `landmarkCoverage` + `vibeMustHaves`
- Landmarks = iconic places any tourist should see (Grand Palace, Big Buddha)
- Vibe Must-Haves = best places for the specific requested vibes (foodie spots for foodie vibes)
- Phuket test: both scored 40/100 — significant room for improvement

### Priority Fixes Identified
1. Enrich ratings post-generation (applyPlaceData) → would push ratingQuality 56→80+
2. Add must-see enforcement in generation prompt → landmarkCoverage improvement
3. Day balance constraints in prompt → 4-5 items/day target
