#!/bin/bash
# Run pipeline for selected destinations
# Each takes ~2-4 minutes, uses ~30-45 SerpAPI calls

SECRET="drift-beta-s3cr3t-x7k9m2"
BASE="http://localhost:3000/api/admin/pipeline"

destinations=(
  '{"city":"Dubai","country":"UAE","vibes":["city","adventure","party","foodie"]}'
  '{"city":"Singapore","country":"Singapore","vibes":["city","foodie","culture","party"]}'
  '{"city":"Maldives","country":"Maldives","vibes":["beach","romance","solo"]}'
  '{"city":"Tokyo","country":"Japan","vibes":["culture","foodie","city","solo"]}'
  '{"city":"Paris","country":"France","vibes":["romance","culture","foodie"]}'
  '{"city":"Jaipur","country":"India","vibes":["culture","foodie","romance","solo"]}'
  '{"city":"Manali","country":"India","vibes":["adventure","winter","romance","solo"]}'
)

echo "=== Pipeline Batch Run ==="
echo "Running ${#destinations[@]} destinations"
echo ""

for i in "${!destinations[@]}"; do
  dest="${destinations[$i]}"
  city=$(echo "$dest" | python3 -c "import sys,json; print(json.load(sys.stdin)['city'])")
  echo "[$((i+1))/${#destinations[@]}] Starting: $city"
  echo "  Time: $(date '+%H:%M:%S')"

  result=$(curl -s -X POST "$BASE" \
    -H "Content-Type: application/json" \
    -H "x-admin-secret: $SECRET" \
    -d "$dest")

  # Check result
  if echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  OK — ID:', d.get('destinationId','?'), '| Stats:', json.dumps(d.get('stats',{})))" 2>/dev/null; then
    true
  else
    echo "  ERROR: $result"
  fi

  echo "  Done: $(date '+%H:%M:%S')"
  echo ""

  # Small delay between destinations
  if [ $i -lt $((${#destinations[@]} - 1)) ]; then
    echo "  Waiting 5s before next..."
    sleep 5
  fi
done

echo "=== All done ==="
