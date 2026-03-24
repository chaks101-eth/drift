# Drift Agent System — Design Document

## Overview

This document designs an agent orchestration system for Drift, adapted from the es-data-pipeline's battle-tested infrastructure. The system enables Claude agents to autonomously handle catalog pipeline operations, data quality, trip generation improvements, and content processing — with human oversight, execution tracking, and learning persistence.

---

## Why Agents for Drift

Drift has several autonomous workflows that benefit from agent orchestration:

| Workflow | Current | With Agents |
|----------|---------|-------------|
| Catalog pipeline (hotels/activities/restaurants) | Manual admin trigger, single-shot | Agent monitors quality, re-runs failed steps, enriches gaps |
| Destination onboarding | Admin runs pipeline per city | Agent handles end-to-end: research → scrape → enrich → validate → activate |
| Data quality | No validation | Agent audits catalog for stale prices, missing fields, bad images |
| Content-to-Trip (future) | Not built | Agent extracts destinations/items from URLs, maps to catalog |
| Trip generation quality | Single LLM call | Agent validates output, catches hallucination, ensures catalog compliance |
| Review/feedback processing | Manual | Agent resolves PR comments, applies fixes |

---

## Architecture — Adapted from es-data-pipeline

### Hierarchy

```
┌─────────────────────────────────────────────────────┐
│                    CHIEF (Router)                     │
│      Routes requests to correct team via API         │
└────────────────────┬────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
    ┌────v────┐ ┌───v────┐ ┌───v────┐
    │ Catalog │ │  AI &  │ │Content │
    │ & Data  │ │Quality │ │Engine  │
    └────┬────┘ └───┬────┘ └───┬────┘
         │          │          │
    Specialists  Specialists  Specialists
```

### Teams & Agents

#### Team 1: Catalog & Data Pipeline
Manages destination data lifecycle — sourcing, enrichment, validation, activation.

| Agent | Purpose | Tools |
|-------|---------|-------|
| `pipeline-orchestrator` | Coordinate full pipeline runs for destinations | Agent (delegates) |
| `hotel-enricher` | Enrich hotel catalog from SerpAPI + Amadeus | Read, Bash, Edit |
| `activity-enricher` | Enrich activity catalog from SerpAPI | Read, Bash, Edit |
| `restaurant-enricher` | Enrich restaurant catalog from SerpAPI | Read, Bash, Edit |
| `template-builder` | Generate itinerary templates from catalog data | Read, Bash, Edit |
| `image-curator` | Find/validate images for catalog items | Read, Bash |
| `price-updater` | Refresh stale prices from APIs | Read, Bash |

#### Team 2: AI & Quality
Ensures trip generation quality and catalog data integrity.

| Agent | Purpose | Tools |
|-------|---------|-------|
| `quality-orchestrator` | Coordinate quality audits | Agent (delegates) |
| `catalog-auditor` | Audit catalog for missing fields, bad data, stale entries | Read, Grep, Bash |
| `trip-validator` | Validate generated itineraries (no hallucination, catalog compliance) | Read, Grep |
| `vibe-scorer` | Audit vibe scoring accuracy, tune weights | Read, Grep, Edit |
| `prompt-tuner` | Test and improve AI prompts | Read, Edit, Bash |

#### Team 3: Content Engine (Post-Launch)
Processes external content into bookable trips.

| Agent | Purpose | Tools |
|-------|---------|-------|
| `content-orchestrator` | Coordinate content-to-trip pipeline | Agent (delegates) |
| `url-extractor` | Extract destinations, hotels, restaurants from URLs | Read, Bash |
| `catalog-mapper` | Map extracted items to Drift catalog entries | Read, Grep |
| `trip-assembler` | Assemble bookable trip board from mapped items | Read, Bash, Edit |

---

## File Structure

```
.claude/
├── agents/
│   ├── chief.md                          # Top-level router
│   │
│   ├── catalog/                          # Team 1: Catalog & Data
│   │   ├── agents/
│   │   │   ├── pipeline-orchestrator.md
│   │   │   ├── hotel-enricher.md
│   │   │   ├── activity-enricher.md
│   │   │   ├── restaurant-enricher.md
│   │   │   ├── template-builder.md
│   │   │   ├── image-curator.md
│   │   │   └── price-updater.md
│   │   └── memory/
│   │       └── team-learnings.md
│   │
│   ├── quality/                          # Team 2: AI & Quality
│   │   ├── agents/
│   │   │   ├── quality-orchestrator.md
│   │   │   ├── catalog-auditor.md
│   │   │   ├── trip-validator.md
│   │   │   ├── vibe-scorer.md
│   │   │   └── prompt-tuner.md
│   │   └── memory/
│   │       └── team-learnings.md
│   │
│   └── content/                          # Team 3: Content Engine
│       ├── agents/
│       │   ├── content-orchestrator.md
│       │   ├── url-extractor.md
│       │   ├── catalog-mapper.md
│       │   └── trip-assembler.md
│       └── memory/
│           └── team-learnings.md
│
├── memory/                               # Org-level learnings
│   └── MEMORY.md
└── settings.local.json                   # Permissions
```

---

## Agent Definition Format

Each agent is a markdown file with YAML frontmatter (matching es-data-pipeline pattern):

```yaml
---
name: hotel-enricher
description: "Enrich hotel catalog entries with SerpAPI data, reviews, and photos"
model: sonnet
tools:
  - Read
  - Edit
  - Bash
  - Grep
  - Glob
color: gold
---

# Hotel Enricher Agent

## Role
You enrich hotel entries in the Drift catalog with real data from SerpAPI and review synthesis.

## Context
- Catalog tables: `catalog_hotels` in Supabase
- Data source: SerpAPI Google Maps (250 free queries/month)
- Pipeline code: `src/lib/pipeline.ts`, `src/lib/serpapi.ts`

## Instructions
1. Read the target destination's hotel entries from catalog
2. For each hotel missing reviews or photos:
   - Call SerpAPI via pipeline functions
   - Extract: rating, review count, top reviews, photos
   - Generate review synthesis (loved/complaints)
   - Update catalog entry metadata
3. Report: hotels enriched, fields updated, any failures

## Output Format
Return JSON:
{
  "status": "completed",
  "destination": "Bali",
  "hotelsProcessed": 12,
  "hotelsEnriched": 10,
  "fieldsFilled": ["reviews", "photos", "honest_take"],
  "failures": [{"hotel": "...", "reason": "SerpAPI rate limit"}]
}

## Safety Rules
- NEVER modify itinerary_items (user data)
- NEVER delete catalog entries — only update/enrich
- NEVER exceed SerpAPI rate limits (check remaining quota first)
- Log all API calls for audit
```

---

## Execution Infrastructure

### Agent Invoker (adapted from es-data-pipeline)

The invoker spawns Claude CLI agents as subprocesses with structured I/O.

**Key Components:**

```
src/lib/agents/
├── invoker.ts           # Core: spawn agent, parse output, track status
├── cli-runner.ts        # Find claude binary, spawn process, manage stdio
├── status-tracker.ts    # Real-time status updates to Supabase
├── types.ts             # AgentRecord, AgentExecution, ExecutionResult
└── prompts/
    ├── orchestrator.ts  # Build orchestrator prompt with context
    └── enrichment.ts    # Build enrichment task prompts
```

### Invoker Flow

```
1. Request arrives (API or cron)
     │
2. Create execution record in Supabase (agent_executions table)
     │  status: 'running', logFilePath, startedAt
     │
3. Build prompt (embed context: destination, catalog state, task params)
     │
4. Spawn Claude CLI subprocess
     │  claude --print --output-format stream-json --agent {agentId} -p {prompt}
     │
5. Stream stdout → parse JSON events
     │  ├── Track sub-agent invocations (Task tool calls)
     │  ├── Extract status descriptions (for UI)
     │  └── Buffer result JSON
     │
6. On completion:
     │  ├── Parse structured output
     │  ├── Update execution record (status, output, duration, cost)
     │  └── Update agent stats
     │
7. Return ExecutionResult
```

### Database Schema (New Tables)

```sql
-- Agent registry
CREATE TABLE agent_registry (
  id TEXT PRIMARY KEY,                    -- e.g., 'hotel-enricher'
  name TEXT NOT NULL,
  team_id TEXT NOT NULL,                  -- e.g., 'catalog'
  description TEXT,
  status TEXT DEFAULT 'active',           -- active, draft, archived
  instructions_path TEXT NOT NULL,        -- .claude/agents/catalog/agents/hotel-enricher.md
  config JSONB DEFAULT '{}',             -- model, tools, color
  memory_config JSONB DEFAULT '{"autoInjectMemory": true, "maxMemoryEntries": 10}',
  stats JSONB DEFAULT '{"totalExecutions": 0}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT
);

-- Execution tracking
CREATE TABLE agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT REFERENCES agent_registry(id),
  team_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',          -- pending, running, completed, failed, cancelled
  action TEXT,                            -- 'enrich-hotels', 'audit-catalog', etc.
  task_description TEXT,
  input_params JSONB,                     -- destination, filters, etc.
  output JSONB,                           -- structured result
  error TEXT,
  log_file_path TEXT,
  pid INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  token_usage JSONB,                      -- {prompt, completion, total, estimatedCost}
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Agent memory / learnings
CREATE TABLE agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT REFERENCES agent_registry(id),
  team_id TEXT,
  scope TEXT DEFAULT 'agent',             -- agent, team, org
  content TEXT NOT NULL,
  source TEXT,                            -- execution_id or manual
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_executions_agent ON agent_executions(agent_id, created_at DESC);
CREATE INDEX idx_executions_status ON agent_executions(status);
CREATE INDEX idx_memory_agent ON agent_memory(agent_id);
```

---

## API Routes

```
/api/agents/
├── GET    /                        → List all agents (with stats)
├── POST   /                        → Create agent (manual or builder)
├── GET    /:id                     → Get agent details
├── PUT    /:id                     → Update agent
├── DELETE /:id                     → Delete agent + cascade
│
├── GET    /:id/instructions        → Read agent .md file
├── PUT    /:id/instructions        → Update agent .md file
│
├── POST   /:id/execute             → Execute agent (fire-and-forget, returns executionId)
├── GET    /:id/executions          → List agent's execution history
│
├── GET    /executions/:execId      → Get execution details
├── GET    /executions/:execId/logs → Stream execution logs (SSE)
├── POST   /executions/:execId/cancel → Kill agent process
│
├── GET    /teams                   → List teams with agent counts
└── GET    /teams/:teamId/agents    → List agents in team
```

---

## Admin Dashboard Integration

Extend the existing `/admin` page with an Agents tab:

```
Admin Dashboard
├── Catalog (existing)
│   ├── Destinations list
│   ├── Pipeline runs
│   └── Stats
│
└── Agents (new)
    ├── Agent Registry
    │   ├── List all agents by team
    │   ├── Status indicators (active/running/failed)
    │   └── Quick execute button
    │
    ├── Executions
    │   ├── Recent executions timeline
    │   ├── Status: running/completed/failed
    │   ├── Duration, token usage, cost
    │   └── Output viewer (JSON)
    │
    └── Quick Actions
        ├── "Enrich [destination]" → pipeline-orchestrator
        ├── "Audit catalog quality" → quality-orchestrator
        └── "Validate latest trips" → trip-validator
```

---

## Orchestrator Patterns

### Pipeline Orchestrator (Destination Onboarding)

```
Trigger: Admin clicks "Add Destination" or cron schedule

Pipeline Orchestrator receives: { destination: "Phuket, Thailand", vibes: ["beach", "nightlife"] }

Step 1: hotel-enricher
  → Input: destination, vibes
  → Output: { hotelsProcessed: 15, hotelsEnriched: 12 }

Step 2: activity-enricher
  → Input: destination, vibes
  → Output: { activitiesProcessed: 20, activitiesEnriched: 18 }

Step 3: restaurant-enricher
  → Input: destination, vibes
  → Output: { restaurantsProcessed: 12, restaurantsEnriched: 10 }

Step 4: template-builder
  → Input: destination, vibes, catalog data from steps 1-3
  → Output: { templatesCreated: 3 (budget/mid/luxury) }

Step 5: image-curator
  → Input: destination, items missing images
  → Output: { imagesFound: 25, itemsUpdated: 25 }

Step 6: catalog-auditor (quality gate)
  → Input: destination, all catalog data
  → Output: { score: 87, issues: [{field: "honest_take", missing: 3}] }

If score >= 80: Mark destination as active
If score < 80: Flag for review, report issues
```

### Quality Orchestrator (Scheduled Audit)

```
Trigger: Weekly cron (or manual from admin)

Quality Orchestrator receives: { scope: "all" | destinationId }

Step 1: catalog-auditor
  → Checks: missing fields, stale prices (>30 days), broken images, low review counts
  → Output: { destinations: [{city, score, issues}] }

Step 2: For each destination with score < 80:
  → price-updater (if stale prices)
  → hotel-enricher (if missing hotel data)
  → image-curator (if broken images)

Step 3: Re-audit
  → Output: { improved: [{city, before: 65, after: 82}], stillBroken: [] }
```

---

## Safety Guardrails

Adapted from es-data-pipeline's proven safety model:

### Hard Rules (NEVER)
- Never modify `trips` or `itinerary_items` tables (user data is sacred)
- Never delete catalog entries — only update, enrich, or flag
- Never exceed API rate limits (Amadeus: 10 req/s test, SerpAPI: 250/mo)
- Never commit directly to main — always create branch + PR
- Never run destructive SQL (DROP, TRUNCATE, DELETE without WHERE)

### Soft Limits (Configurable)
- Max 5 files changed per agent execution
- Max 200 lines changed per execution
- Max 3 API calls per enrichment item (prevent runaway costs)
- Max execution time: 10 minutes per agent, 30 minutes per orchestrator
- Confidence threshold: Agents must report confidence > 0.7 before modifying catalog

### Feedback Loops
```
maxEnrichmentRetries: 2       # Retry failed enrichments
maxAuditAttempts: 2           # Re-audit after fixes
cooldownMinutes: 60           # Wait between full pipeline runs
totalMaxAttempts: 5           # Hard stop for any workflow
```

---

## Execution Tracking

### Execution Record Lifecycle

```
Created (pending)
    → Running (PID assigned, logs streaming)
        → Completed (output saved, duration recorded)
        → Failed (error captured, agent stats updated)
        → Cancelled (process killed, cleanup done)
```

### What Gets Tracked

| Field | Purpose |
|-------|---------|
| `status` | Current state of execution |
| `input_params` | What was asked (destination, task, filters) |
| `output` | Structured JSON result from agent |
| `error` | Error message if failed |
| `duration_ms` | Wall clock time |
| `token_usage` | Prompt + completion tokens + estimated cost |
| `log_file_path` | Path to full agent log for debugging |
| `pid` | Process ID for cancellation |

### Cost Tracking

Track token usage per execution to monitor spend:
- Gemini 2.5 Flash: Free tier (1500 req/day)
- Claude Sonnet: ~$3/1M input, $15/1M output
- Amadeus API: Free (test env)
- SerpAPI: 250 free/month, then $50/1000

---

## Memory & Learning System

### Per-Agent Memory
Each agent accumulates learnings in `.claude/agents/{team}/memory/{agent}-memory.md`:

```markdown
# Hotel Enricher — Learnings

## 2026-03-17: Bali enrichment
- SerpAPI returns "Permanently closed" for some listings — must filter these
- Google Maps ratings are 0.3 higher than Booking.com on average
- Hotels near Ubud center have 20% higher review counts

## 2026-03-18: Phuket enrichment
- Some beach hotels show up under "resorts" category in SerpAPI
- Must search both "hotels" and "resorts" for beach destinations
```

### Team Memory
Shared across team in `.claude/agents/{team}/memory/team-learnings.md`:

```markdown
# Catalog Team — Shared Learnings

- SerpAPI quota resets at midnight UTC
- Destinations with <5 hotels should not be activated
- Template generation works best with 10+ activities in catalog
- Vibe scoring requires at least 3 vibes per item for accuracy
```

### Memory Injection
When an agent is invoked, its memory + team memory are prepended to the prompt:
```
[AGENT MEMORY — last 10 entries]
...learnings...

[TEAM MEMORY — last 5 entries]
...shared learnings...

[TASK]
Your actual task prompt here...
```

---

## Cron Schedules

| Schedule | Agent | Task |
|----------|-------|------|
| Daily 6am UTC | `price-updater` | Refresh flight prices for active destinations |
| Weekly Monday | `quality-orchestrator` | Full catalog audit |
| On pipeline completion | `catalog-auditor` | Validate new destination data |
| On trip generation | `trip-validator` | Validate itinerary (async, non-blocking) |

---

## Migration Path

### Phase 1: Foundation (Week 1)
- [ ] Create `.claude/agents/` directory structure
- [ ] Write agent definition files (chief + catalog team)
- [ ] Add `agent_registry`, `agent_executions`, `agent_memory` tables to Supabase
- [ ] Build `src/lib/agents/invoker.ts` (adapted from es-data-pipeline)
- [ ] Build `src/lib/agents/cli-runner.ts`
- [ ] Add `/api/agents/` routes (list, execute, status)

### Phase 2: Catalog Agents (Week 2)
- [ ] Implement `pipeline-orchestrator` agent
- [ ] Implement `hotel-enricher`, `activity-enricher`, `restaurant-enricher`
- [ ] Implement `template-builder`
- [ ] Wire up admin dashboard Agents tab
- [ ] Test full destination onboarding flow

### Phase 3: Quality & Automation (Week 3)
- [ ] Implement `catalog-auditor` and `quality-orchestrator`
- [ ] Implement `trip-validator`
- [ ] Add cron triggers for scheduled audits
- [ ] Implement execution log streaming (SSE)
- [ ] Add cost tracking dashboard

### Phase 4: Content Engine (Post-Launch)
- [ ] Implement `url-extractor` (parse travel URLs)
- [ ] Implement `catalog-mapper` (match extracted items to catalog)
- [ ] Implement `trip-assembler` (build bookable trip from content)
- [ ] Wire up Content-to-Trip UI flow

---

## Key Differences from es-data-pipeline

| Aspect | es-data-pipeline | Drift |
|--------|-----------------|-------|
| Database | MongoDB | Supabase (PostgreSQL) |
| Agent count | 100+ agents, 8 teams | ~15 agents, 3 teams |
| Logging | CloudWatch + S3 | Supabase storage + local files |
| PR management | Full GitHub PR lifecycle | Simpler — catalog data changes, not code PRs |
| Scale | 18-agent pipeline operations | Lightweight — catalog enrichment + quality |
| Healing | Autonomous failure detection + fix | Manual trigger + scheduled audits |
| Judge system | Auto-generated judges per agent | Not needed initially — human review via admin |
| Memory | MongoDB collection | Supabase table + .md files |

---

## Dependencies

No new npm packages needed. The system uses:
- **Claude CLI** (`claude` binary) — already available in dev environment
- **Supabase client** — already in project
- **Node.js child_process** — built-in, for agent subprocess spawning
- **Existing pipeline code** — `src/lib/pipeline.ts`, `src/lib/serpapi.ts`, `src/lib/amadeus.ts`

---

*Last updated: March 17, 2026*
