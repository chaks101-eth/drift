# Integration Guide — `feat/pipeline-catalog-admin`

Read this before merging PR #1. The merge itself is clean at the file level — but five behavioral / operational changes will bite you if missed.

## ⚠️ MUST READ: Run the pipeline against the Drift PROD Supabase

**The catalog the live app reads from lives in *one* Supabase project — the production Drift project.** Anything the pipeline writes to a different project is invisible to real users.

> **Do not** run the pipeline against your local/dev Supabase for "real" catalog work. Your dev project is fine for *testing the code path*, but every place you actually want filled (Phuket, Bali, Goa, etc.) needs to be written to the prod project, or it never reaches users.

### What you need from Maulik (out-of-band — DM or 1Password, **not** in this repo)

```bash
NEXT_PUBLIC_SUPABASE_URL=<prod Drift Supabase URL>
SUPABASE_SERVICE_ROLE_KEY=<prod service role key — server-only, bypasses RLS>
SUPABASE_DB_URL=<prod Postgres connection string, for running migrations via psql>
```

Same values are visible in the Vercel project (`drift` production deployment) → Settings → Environment Variables → Production. If you have access there, copy from there.

### Set them in your `.env.local`

Replace whatever's currently in your `.env.local` for these three keys with the prod values. Keep everything else (Amadeus, Gemini, Groq, SerpAPI keys, etc.) the same — those are independent.

### Verify before running anything

```bash
# Should print the PROD project URL, not your dev one
grep NEXT_PUBLIC_SUPABASE_URL .env.local

# Sanity-check that the pipeline can see catalog tables on prod
# (run from repo root, requires SUPABASE_SERVICE_ROLE_KEY in env)
node -e "
  require('dotenv').config({ path: '.env.local' });
  const { createClient } = require('@supabase/supabase-js');
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  db.from('catalog_destinations').select('slug').limit(5).then(({data, error}) => {
    if (error) return console.error('FAIL:', error);
    console.log('OK — destinations sample:', data.map(d => d.slug));
  });
"
```

If that prints actual Drift destination slugs (`bali`, `phuket`, etc.), you're pointed at prod. If it errors or returns nothing, you're either still on your dev DB or the keys are wrong — fix that **before** running the migration.

### Security reminders

- **Service role key bypasses RLS.** Anyone with it can read/write any row in the DB. Never commit it, never paste it in PR comments / Slack channels / chat history. Treat it like a production database password (because it effectively is one).
- **The Supabase URL alone is less sensitive** but still shouldn't be hardcoded in a public repo — that's why it's not in this file.
- **Rotate the service role key** if it's ever accidentally exposed (Supabase Dashboard → Project Settings → API → Reset service_role secret).

## TL;DR runbook (in this order)

```bash
# 0. Confirm your .env.local points at the PROD Drift Supabase (see top of this file).
#    psql connection string for the same project:
#    SUPABASE_DB_URL="postgresql://postgres.<project-ref>:<db-password>@aws-0-<region>.pooler.supabase.com:6543/postgres"
#    (Get the exact string from Supabase Dashboard → Project Settings → Database → Connection string)

# 1. Merge the PR
git checkout main && git pull origin main

# 2. Regenerate lock (most reliable way to resolve any package-lock conflicts)
rm package-lock.json && npm install

# 3. Pre-flight: check for duplicates that would break the new unique index
#    (see "Migration safety" section below) — run these against the PROD DB

# 4. Run the migration against the PROD Drift Supabase
psql "$SUPABASE_DB_URL" -f supabase/migrations/004_catalog_freshness.sql

# 5. Backfill place_id on existing rows so the new unique index actually helps
node scripts/backfill-place-ids.ts

# 6. Update existing catalog readers to filter status='active' (see section 3)

# 7. Deploy

# 8. (Optional) Refresh broken/old-format images
node scripts/fix-broken-images.js --dry-run   # inspect first
node scripts/fix-broken-images.js             # apply
```

## 1. Migration must run BEFORE deploying the new code

`supabase/migrations/004_catalog_freshness.sql` adds columns the new pipeline writes (`updated_at`, `place_id`, `status`, `rating`). Deploy the code without the migration and the pipeline crashes on every upsert.

**Order: migrate → deploy → backfill.** Never deploy first.

## 2. Migration safety — check for duplicates first

The migration creates `UNIQUE(destination_id, place_id)` on each of `catalog_hotels`, `catalog_activities`, `catalog_restaurants`. Postgres allows multiple NULL `place_id` (NULL != NULL), but any pre-existing duplicate `(destination_id, place_id)` pair with non-NULL `place_id` will fail the index creation.

Run this **before** the migration:

```sql
-- If any of these return rows, dedup first
SELECT destination_id, place_id, count(*)
FROM catalog_hotels WHERE place_id IS NOT NULL
GROUP BY destination_id, place_id HAVING count(*) > 1;

SELECT destination_id, place_id, count(*)
FROM catalog_activities WHERE place_id IS NOT NULL
GROUP BY destination_id, place_id HAVING count(*) > 1;

SELECT destination_id, place_id, count(*)
FROM catalog_restaurants WHERE place_id IS NOT NULL
GROUP BY destination_id, place_id HAVING count(*) > 1;
```

If you don't have a `place_id` column yet (you won't — that's part of this migration), you're safe to migrate; duplicates can only appear once `place_id` starts getting populated by `backfill-place-ids.ts`.

## 3. Soft-delete changes catalog read semantics ⚠️

Pipeline no longer hard-deletes stale catalog rows. It sets `status = 'inactive'`. Any read query that doesn't filter by `status = 'active'` will return soft-deleted rows.

**Audit before deploy.** These existing readers do NOT filter by status today and need an `.eq('status', 'active')` added:

| File | Lines without filter |
|---|---|
| `src/lib/ai-context.ts` | 150, 165, 179, 219–221, 287–289 |
| `src/lib/catalog.ts` | 142–144 |

(Other queries in those same files already filter correctly — only the lines above need a one-liner addition.)

Anything in the new product/UI surface you've added (mobile pages, share view, etc.) that reads from `catalog_*` directly should also be checked.

## 4. Photo URL format changed

The enrichment helpers (`google-places.ts`, `google-places-photos.ts`) now follow the redirect from the Google Maps Photo API and store the resolved `https://lh3.googleusercontent.com/...` CDN URL directly. Benefits: no API key in URL, no redirect hop, immutable.

**Impact:**
- **New rows**: `googleusercontent.com` URLs.
- **Existing rows**: still old `maps.googleapis.com/maps/api/place/photo?...` format until re-enriched or repaired.

If any code on your side parses or validates photo URLs (regex, hostname allowlist, CDN caching headers), check it handles both formats — or run `scripts/fix-broken-images.js` to migrate existing rows to the new format.

## 5. Dependency changes

- `@anthropic-ai/sdk` 0.80 → 0.90 — minor bump. Used only in `src/lib/discovery.ts` for the catalog discovery loop.
- `@supabase/supabase-js` 2.98 → 2.103 — patch-ish bump, no API changes affecting current usage.
- `next` 16.1.6 → 16.2.4 — patch bump.
- ~~`@supabase/ssr`~~ — was in an earlier version of this PR; dropped because nothing imports it.

After merge: `rm package-lock.json && npm install` is the simplest conflict-free path.

## Pipeline integration surface

If you want to call the new pipeline directly:

```ts
import { runPipeline } from '@/lib/pipeline'

await runPipeline({
  destination: 'Phuket',
  // ... see DestinationConfig type in pipeline.ts
})
```

Public exports (signatures unchanged from prior `pipeline.ts`):
- `runPipeline(config)` — full 6-step run
- `runSingleStep(...)` — individual step (admin dashboard uses this)
- `getPipelineRun(runId)` — fetch a run record
- `getCatalogStats()` — counts per destination

New supporting modules (use directly if useful):
- `src/lib/discovery.ts` — `discoverPlaces()` and `withRetry()` for retry wrapping any async
- `src/lib/quota-tracker.ts` — `QuotaTracker` for per-day API quota accounting

## Tests

```bash
npx vitest run src/lib/__tests__/pipeline-upsert.test.ts \
               src/lib/__tests__/quota-tracker.test.ts \
               src/lib/__tests__/retry.test.ts
```

## Smoke test after deploy

1. Visit `/admin` — dashboard view should load (no console errors, catalog counts visible).
2. Trigger a pipeline run for one destination from the admin UI.
3. Inspect `catalog_hotels` / `catalog_activities` / `catalog_restaurants` — newly written rows should have `updated_at`, `place_id`, `status='active'`, and `image_url` ending in `googleusercontent.com` for entries with photos.
4. Re-run the same destination — rows should upsert (no duplicates), `updated_at` should advance.

## Rollback

If something is wrong post-deploy:

1. Revert the code deploy first (the migration is forward-compatible — extra columns/indexes don't break the previous code).
2. If the migration itself failed mid-way: each `ALTER TABLE` / `CREATE INDEX` is guarded with `IF NOT EXISTS`, so re-running is safe.
3. To unwind the schema entirely (rare): drop the new indexes, drop the columns. The triggers can stay — they're harmless if columns exist.
