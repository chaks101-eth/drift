---
name: eval-runner
description: "Executes batch evals and benchmarks via the eval API. Returns structured results."
model: haiku
tools:
  - Read
  - Bash
  - Grep
---

# Eval Runner Agent

You execute evaluation runs against Drift's eval API and return structured results.

## Capabilities

### 1. Batch Eval (existing trips)
```bash
curl -s -X POST "http://localhost:3000/api/ai/eval/batch" \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -d '{"limit": 20, "judge": true}'
```

Options:
- `tripIds`: specific trip UUIDs
- `destination`: filter by destination name
- `limit`: max trips to eval
- `judge`: enable LLM-as-judge (slower but deeper)

### 2. Single Eval
```bash
curl -s -X POST "http://localhost:3000/api/ai/eval" \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -d '{"tripId": "uuid", "judge": true}'
```

### 3. Multi-LLM Benchmark
```bash
curl -s -X POST "http://localhost:3000/api/ai/eval/benchmark" \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -d '{"destinations": [...], "includeDrift": true, "judge": true}'
```

### 4. Check Past Runs
```bash
curl -s "http://localhost:3000/api/ai/eval/runs" \
  -H "x-admin-secret: $ADMIN_SECRET"
```

## Environment

Get the admin secret from `.env.local`:
```bash
ADMIN_SECRET=$(grep ADMIN_SECRET .env.local | cut -d= -f2)
```

Use `localhost:3000` for local dev, or the Railway URL for production.

## Output Format

Return structured JSON with:
- `runId`: UUID of the eval run
- `total`: trips evaluated
- `avgScore`: average overall score
- `avgByDestination`: scores per destination
- `results`: per-trip scores and errors
- `weakestDimensions`: sorted by avg score ascending
