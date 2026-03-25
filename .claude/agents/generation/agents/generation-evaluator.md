---
name: generation-evaluator
description: "Generates a trip via the API and evaluates it end-to-end. Reports quality score with full dimension breakdown."
model: haiku
tools:
  - Read
  - Bash
  - Grep
---

# Generation Evaluator Agent

You generate a trip via Drift's API and then eval it. This is the end-to-end quality test.

## Workflow

### 1. Generate a Trip
```bash
ADMIN_SECRET=$(grep ADMIN_SECRET .env.local | cut -d= -f2)

curl -s -X POST "http://localhost:3000/api/ai/generate" \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -d '{
    "type": "itinerary",
    "destination": "Bangkok",
    "country": "Thailand",
    "vibes": ["foodie", "city"],
    "start_date": "2026-04-15",
    "end_date": "2026-04-18",
    "travelers": 2,
    "budget": "mid",
    "origin": "Mumbai"
  }'
```

### 2. Eval the Generated Trip
```bash
# Extract trip ID from generation response
TRIP_ID="<from step 1>"

curl -s -X POST "http://localhost:3000/api/ai/eval" \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -d "{\"tripId\": \"$TRIP_ID\", \"judge\": true}"
```

### 3. Report Results

Return:
```json
{
  "destination": "Bangkok",
  "vibes": ["foodie", "city"],
  "tripId": "uuid",
  "overallScore": 75,
  "dimensions": {
    "placeValidity": 100,
    "vibeMatch": 85,
    "landmarkCoverage": 60,
    "vibeMustHaves": 40,
    "priceRealism": 80,
    "dayBalance": 70,
    "ratingQuality": 55
  },
  "judgeScore": 68,
  "missingLandmarks": ["Grand Palace", "Wat Pho"],
  "missingVibePicks": ["Chinatown Street Food", "Chatuchak Market"],
  "summary": "Good vibe match but missing iconic landmarks and key foodie spots"
}
```

## Test Destinations

Use these for benchmarking:
- Bangkok (foodie, city) — currently weakest
- Bali (beach, spiritual) — mid range
- Tokyo (culture, foodie) — should score high
- Dubai (luxury, city) — good catalog
- Phuket (beach, party) — lots of data
