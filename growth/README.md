# Drift Growth System

## Structure

```
growth/
├── content/          → Generated content (blog posts, social captions, emails)
├── social/           → Post tracking (posts.jsonl)
├── reports/          → Weekly growth reports
└── README.md         → This file
```

## Agent Framework

Agents live at `.claude/agents/growth/`:
- `growth-chief.md` — Orchestrates daily growth cycle
- `content/content-creator.md` — Generates content from trip data
- `social/social-distributor.md` — Posts to platforms
- `email/email-campaigner.md` — Email outreach via Resend
- `analytics/analytics-reporter.md` — Tracks metrics

## Running Growth Cycle

```bash
# Generate content from trip data
claude -a .claude/agents/growth/content/content-creator.md "Generate 3 Reddit posts from our best Istanbul and Tokyo trip data"

# Run the full growth cycle
claude -a .claude/agents/growth/growth-chief.md "Run today's growth cycle"

# Generate weekly report
claude -a .claude/agents/growth/analytics/analytics-reporter.md "Generate this week's growth report"
```

## Services

| Service | Purpose | API Key Env Var | Cost |
|---------|---------|-----------------|------|
| Resend | Email | RESEND_API_KEY | Free (3K/mo) |
| Reddit | Posts | Reddit OAuth | Free |
| Twitter/X | Threads | TWITTER_BEARER_TOKEN | Free (basic) |
| dev.to | Blog | DEVTO_API_KEY | Free |

## Metrics Tracked

1. New signups/day
2. Trips created/day
3. Funnel: landed → signup → vibes → destination → generate → board → booking
4. Social post engagement (UTM tracking)
5. Email open/click rates
6. Itinerary quality scores
