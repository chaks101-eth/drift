-- ============================================
-- DRIFT — Growth Engine
-- Content queue, posts, metrics, learnings, runs
-- ============================================

CREATE TABLE IF NOT EXISTS public.growth_content (
  id uuid default uuid_generate_v4() primary key,
  platform text not null,
  content_type text not null,
  title text,
  body text not null,
  media_urls text[] default '{}',
  video_url text,
  hashtags text[] default '{}',
  destination text,
  trip_id uuid references public.trips(id) on delete set null,
  eval_score int,
  status text default 'draft' check (status in ('draft', 'approved', 'scheduled', 'posted', 'failed', 'rejected')),
  rejection_reason text,
  scheduled_for timestamptz,
  utm_campaign text,
  generation_prompt text,
  model text default 'gemini-2.5-flash',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.growth_posts (
  id uuid default uuid_generate_v4() primary key,
  content_id uuid references public.growth_content(id) on delete cascade,
  platform text not null,
  platform_post_id text,
  post_url text,
  subreddit text,
  posted_at timestamptz default now(),
  posted_by text default 'system'
);

CREATE TABLE IF NOT EXISTS public.growth_metrics (
  id uuid default uuid_generate_v4() primary key,
  post_id uuid references public.growth_posts(id) on delete cascade,
  impressions int default 0,
  clicks int default 0,
  likes int default 0,
  comments int default 0,
  shares int default 0,
  saves int default 0,
  site_visits int default 0,
  signups int default 0,
  trips_created int default 0,
  measured_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.growth_learnings (
  id uuid default uuid_generate_v4() primary key,
  category text,
  insight text not null,
  action text,
  confidence float default 0.5,
  based_on_posts int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.growth_runs (
  id uuid default uuid_generate_v4() primary key,
  cycle_type text,
  status text default 'running' check (status in ('running', 'completed', 'failed')),
  content_generated int default 0,
  content_approved int default 0,
  content_rejected int default 0,
  posts_published int default 0,
  emails_sent int default 0,
  metrics_snapshot jsonb default '{}',
  learnings_generated int default 0,
  started_at timestamptz default now(),
  completed_at timestamptz,
  error text
);

CREATE INDEX IF NOT EXISTS idx_growth_content_status ON public.growth_content(status);
CREATE INDEX IF NOT EXISTS idx_growth_content_platform ON public.growth_content(platform);
CREATE INDEX IF NOT EXISTS idx_growth_posts_platform ON public.growth_posts(platform);
CREATE INDEX IF NOT EXISTS idx_growth_metrics_post ON public.growth_metrics(post_id);
CREATE INDEX IF NOT EXISTS idx_growth_learnings_active ON public.growth_learnings(is_active);
CREATE INDEX IF NOT EXISTS idx_growth_runs_status ON public.growth_runs(status);
