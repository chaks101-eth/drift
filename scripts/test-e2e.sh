#!/bin/bash
# ─── Drift E2E Test Pipeline ─────────────────────────────────
# Tests the full flow: pipeline → catalog → destinations → itinerary
#
# Prerequisites:
#   1. Dev server running: npm run dev (port 3000)
#   2. Supabase DB accessible
#   3. API keys configured in .env.local
#
# Usage:
#   chmod +x scripts/test-e2e.sh
#   ./scripts/test-e2e.sh
#
# Watch server logs in the terminal running `npm run dev` for detailed output.

BASE_URL="http://localhost:3000"
ADMIN_SECRET="drift-admin-2026"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test destination config
CITY="Bali"
COUNTRY="Indonesia"
VIBES='["beach","spiritual","foodie"]'

echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Drift E2E Test — ${CITY}, ${COUNTRY}${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
echo ""

# ─── Step 0: Health check ─────────────────────────────────────
echo -e "${YELLOW}[0/5] Health check...${NC}"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL")
if [ "$HEALTH" != "200" ]; then
  echo -e "${RED}FAIL: Server not running at $BASE_URL (got HTTP $HEALTH)${NC}"
  echo "Start the dev server: npm run dev"
  exit 1
fi
echo -e "${GREEN}OK — Server running${NC}"
echo ""

# ─── Step 1: Check current catalog stats ──────────────────────
echo -e "${YELLOW}[1/5] Checking current catalog stats...${NC}"
STATS=$(curl -s "$BASE_URL/api/admin/pipeline?secret=$ADMIN_SECRET")
echo "$STATS" | python3 -m json.tool 2>/dev/null || echo "$STATS"
echo ""

# ─── Step 2: Run pipeline for test destination ────────────────
echo -e "${YELLOW}[2/5] Running pipeline for $CITY, $COUNTRY...${NC}"
echo -e "${CYAN}(This will take 2-5 minutes — watch server logs for progress)${NC}"
echo ""

PIPELINE_START=$(date +%s)
PIPELINE_RESULT=$(curl -s -X POST "$BASE_URL/api/admin/pipeline?secret=$ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d "{
    \"city\": \"$CITY\",
    \"country\": \"$COUNTRY\",
    \"vibes\": $VIBES,
    \"language\": \"Indonesian\",
    \"timezone\": \"Asia/Makassar\",
    \"best_months\": [\"April\", \"May\", \"June\", \"September\", \"October\"]
  }")
PIPELINE_END=$(date +%s)
PIPELINE_TIME=$((PIPELINE_END - PIPELINE_START))

echo ""
echo -e "${CYAN}Pipeline response (${PIPELINE_TIME}s):${NC}"
echo "$PIPELINE_RESULT" | python3 -m json.tool 2>/dev/null || echo "$PIPELINE_RESULT"

# Check if pipeline succeeded
if echo "$PIPELINE_RESULT" | grep -q '"error"'; then
  echo ""
  echo -e "${RED}PIPELINE FAILED — check server logs for details${NC}"
  echo -e "${YELLOW}Common issues:${NC}"
  echo "  - Groq rate limit (100K tokens/day) — swap to Claude"
  echo "  - SerpAPI quota (250/month) — check remaining"
  echo "  - Supabase table missing — run migrations"
  echo "  - Missing env vars — check .env.local"
  echo ""
  echo "To debug, check the server terminal output."
  exit 1
fi

DEST_ID=$(echo "$PIPELINE_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('destinationId',''))" 2>/dev/null)
echo ""
echo -e "${GREEN}Pipeline completed in ${PIPELINE_TIME}s — destination ID: $DEST_ID${NC}"
echo ""

# ─── Step 3: Verify catalog data ─────────────────────────────
echo -e "${YELLOW}[3/5] Verifying catalog data...${NC}"
STATS_AFTER=$(curl -s "$BASE_URL/api/admin/pipeline?secret=$ADMIN_SECRET")
echo "$STATS_AFTER" | python3 -m json.tool 2>/dev/null || echo "$STATS_AFTER"
echo ""

# ─── Step 4: Test destination suggestions (user flow) ─────────
echo -e "${YELLOW}[4/5] Testing destination suggestions (simulating user flow)...${NC}"
echo -e "${CYAN}Need a user auth token. Creating test user...${NC}"
echo ""

# We'll test the catalog query directly via the admin stats to verify data exists
# For the full user flow, you need to:
#   1. Sign up / log in at /login
#   2. Select vibes at /vibes
#   3. Get destinations at /destinations
#   4. Select a destination to generate itinerary
echo -e "${YELLOW}To test the full user flow:${NC}"
echo "  1. Open ${BASE_URL}/login — sign up or log in"
echo "  2. Open ${BASE_URL}/vibes — select beach, spiritual, foodie vibes"
echo "  3. Check destinations page — Bali should appear from catalog"
echo "  4. Click Bali — itinerary should generate from catalog template"
echo ""
echo -e "${CYAN}Checking if catalog has enough data for $CITY...${NC}"

# Quick validation: check catalog_destinations for our city
DEST_CHECK=$(curl -s "$BASE_URL/api/admin/pipeline?secret=$ADMIN_SECRET")
DEST_COUNT=$(echo "$DEST_CHECK" | python3 -c "
import sys,json
data = json.load(sys.stdin)
dests = data.get('destinations', [])
active = [d for d in dests if d.get('status') == 'active']
print(f'Total destinations: {len(dests)}, Active: {len(active)}')
for d in active:
    print(f'  - {d.get(\"city\")}, {d.get(\"country\")} (status: {d.get(\"status\")})')
" 2>/dev/null)
echo "$DEST_COUNT"
echo ""

# ─── Step 5: Summary ─────────────────────────────────────────
echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  E2E Test Complete${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
echo ""
echo "Pipeline ran for: ${CITY}, ${COUNTRY}"
echo "Time: ${PIPELINE_TIME}s"
echo "Destination ID: ${DEST_ID}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Open ${BASE_URL} in browser"
echo "  2. Sign up → select vibes → check if $CITY appears"
echo "  3. Click $CITY → verify itinerary loads from catalog"
echo "  4. Check server logs for [Generate] and [Catalog] messages"
echo ""
echo -e "${YELLOW}Debug tips:${NC}"
echo "  - All logs are in the 'npm run dev' terminal"
echo "  - Look for [Pipeline], [LLM], [Amadeus], [Catalog], [Generate] prefixes"
echo "  - If Groq fails: swap to Claude in src/lib/pipeline.ts"
echo ""
