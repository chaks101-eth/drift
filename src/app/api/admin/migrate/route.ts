import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_SECRET = process.env.ADMIN_SECRET

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('x-admin-secret') || req.nextUrl.searchParams.get('secret')
  return auth === ADMIN_SECRET
}

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function runSQL(sql: string): Promise<{ success: boolean; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

  // Use Supabase's pg_net or the SQL API
  const res = await fetch(`${url}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })

  if (!res.ok) {
    // Fallback: this won't work without a custom RPC, return instructions
    return { success: false, error: 'Direct SQL execution not available via REST API' }
  }
  return { success: true }
}

// POST /api/admin/migrate — check eval tables, try to create, or return SQL
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getAdminClient()
  const tables = ['eval_runs', 'eval_results', 'eval_place_cache']
  const status: Record<string, string> = {}

  for (const table of tables) {
    const { error } = await db.from(table).select('id').limit(1)
    if (error?.code === 'PGRST205' || error?.message?.includes('does not exist')) {
      status[table] = 'missing'
    } else if (error) {
      status[table] = `error: ${error.message}`
    } else {
      status[table] = 'exists'
    }
  }

  const needsMigration = Object.values(status).some(s => s === 'missing')

  // If tables need creation, return the SQL to paste into Supabase SQL Editor
  const migrationSQL = needsMigration ? `-- Run this in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS public.eval_runs (
  id uuid default uuid_generate_v4() primary key,
  run_type text not null check (run_type in ('single', 'batch', 'benchmark')),
  status text default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  config jsonb not null default '{}',
  total_tasks int default 0,
  completed_tasks int default 0,
  failed_tasks int default 0,
  aggregate_scores jsonb default '{}',
  analysis jsonb default null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.eval_results (
  id uuid default uuid_generate_v4() primary key,
  run_id uuid references public.eval_runs(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  llm_provider text not null default 'drift',
  destination text not null,
  country text default '',
  vibes text[] default '{}',
  days int default 0,
  item_count int default 0,
  overall_score int default 0,
  dimension_scores jsonb not null default '{}',
  items_snapshot jsonb default '[]',
  judge_analysis jsonb default null,
  error text,
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_eval_results_run ON public.eval_results(run_id);
CREATE INDEX IF NOT EXISTS idx_eval_results_trip ON public.eval_results(trip_id);
CREATE INDEX IF NOT EXISTS idx_eval_results_dest ON public.eval_results(destination);
CREATE INDEX IF NOT EXISTS idx_eval_results_provider ON public.eval_results(llm_provider);
CREATE INDEX IF NOT EXISTS idx_eval_results_score ON public.eval_results(overall_score);

CREATE TABLE IF NOT EXISTS public.eval_place_cache (
  id uuid default uuid_generate_v4() primary key,
  place_name text not null,
  destination text not null,
  country text default '',
  exists_on_google boolean not null,
  place_data jsonb default '{}',
  fetched_at timestamptz default now(),
  expires_at timestamptz not null
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_place_cache_key
  ON public.eval_place_cache(lower(place_name), lower(destination));` : null

  return NextResponse.json({
    status,
    ready: !needsMigration,
    instructions: needsMigration
      ? 'Tables need to be created. Copy the SQL below and run it in Supabase Dashboard → SQL Editor.'
      : 'All eval tables exist. System is ready.',
    sql: migrationSQL,
  })
}
