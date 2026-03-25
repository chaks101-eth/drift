-- ============================================
-- DRIFT — Eval System
-- Production-grade itinerary evaluation, multi-LLM benchmarking, and pattern analysis
-- ============================================

-- ============================================
-- EVAL RUNS — batch run metadata
-- ============================================
create table public.eval_runs (
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

-- ============================================
-- EVAL RESULTS — per-trip evaluation scores
-- ============================================
create table public.eval_results (
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

create index idx_eval_results_run on public.eval_results(run_id);
create index idx_eval_results_trip on public.eval_results(trip_id);
create index idx_eval_results_dest on public.eval_results(destination);
create index idx_eval_results_provider on public.eval_results(llm_provider);
create index idx_eval_results_score on public.eval_results(overall_score);

-- ============================================
-- EVAL PLACE CACHE — Google Places verification cache (30-day TTL)
-- ============================================
create table public.eval_place_cache (
  id uuid default uuid_generate_v4() primary key,
  place_name text not null,
  destination text not null,
  country text default '',
  exists_on_google boolean not null,
  place_data jsonb default '{}',
  fetched_at timestamptz default now(),
  expires_at timestamptz not null
);

create unique index idx_place_cache_key
  on public.eval_place_cache(lower(place_name), lower(destination));
