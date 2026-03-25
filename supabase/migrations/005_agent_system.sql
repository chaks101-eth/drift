-- ============================================
-- DRIFT — Agent System
-- Registry, execution tracking, and memory for Claude agents
-- ============================================

CREATE TABLE IF NOT EXISTS public.agent_registry (
  id text primary key,
  name text not null,
  team_id text not null,
  description text,
  status text default 'active' check (status in ('active', 'draft', 'archived')),
  instructions_path text not null,
  config jsonb default '{}',
  stats jsonb default '{"totalExecutions": 0, "avgDuration": 0, "lastRun": null}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.agent_executions (
  id uuid default uuid_generate_v4() primary key,
  agent_id text references public.agent_registry(id) on delete set null,
  team_id text not null,
  status text default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  action text,
  task_description text,
  input_params jsonb default '{}',
  output jsonb default '{}',
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms int,
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_agent_exec_agent ON public.agent_executions(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_exec_status ON public.agent_executions(status);
CREATE INDEX IF NOT EXISTS idx_agent_exec_team ON public.agent_executions(team_id);

CREATE TABLE IF NOT EXISTS public.agent_memory (
  id uuid default uuid_generate_v4() primary key,
  agent_id text references public.agent_registry(id) on delete cascade,
  team_id text,
  scope text default 'agent' check (scope in ('agent', 'team', 'org')),
  content text not null,
  source text,
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_agent ON public.agent_memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_team ON public.agent_memory(team_id);
