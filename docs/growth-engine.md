# Drift Growth Engine — Technical Specification

## Overview

An autonomous growth system that generates content from real trip data, distributes across social platforms, collects engagement metrics, learns what works, and continuously improves — all controllable from the admin dashboard.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN DASHBOARD (/admin → Growth)            │
│                                                                 │
│  ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │ Generate  │ │ Content  │ │ Schedule │ │ Analytics &      │  │
│  │ Content   │ │ Queue    │ │ & Post   │ │ Learnings        │  │
│  └─────┬─────┘ └────┬─────┘ └────┬─────┘ └────────┬─────────┘  │
└────────┼────────────┼────────────┼─────────────────┼────────────┘
         │            │            │                 │
         ▼            ▼            ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GROWTH ENGINE API                            │
│                                                                 │
│  POST /api/growth/generate    Content from trip data + eval     │
│  GET  /api/growth/content     List content queue                │
│  PUT  /api/growth/content/:id Approve/reject/edit               │
│  POST /api/growth/post        Publish to platform               │
│  POST /api/growth/video       Generate video from trip photos   │
│  GET  /api/growth/metrics     Engagement data across platforms  │
│  POST /api/growth/learn       Run learning cycle                │
│  GET  /api/growth/learnings   What's working, what's not       │
└─────────────────────────────────────────────────────────────────┘
         │
         ├── Gemini API (content generation)
         ├── Shotstack/Creatomate (video generation)
         ├── Reddit API (post + metrics)
         ├── Twitter API (post + metrics)
         ├── Meta Graph API (Instagram post + metrics)
         ├── TikTok Content API (post + metrics)
         ├── dev.to API (blog publishing)
         ├── Resend (email campaigns)
         ├── GA4 Reporting API (UTM attribution)
         └── Supabase (content queue, posts, metrics, learnings)
```

---

## Database Schema

### Tables

```sql
-- ─── Content Queue ───────────────────────────────────────────
-- Stores all generated content before and after posting.
CREATE TABLE growth_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What was generated
  platform TEXT NOT NULL,           -- reddit | twitter | instagram | tiktok | blog | email
  content_type TEXT NOT NULL,       -- post | thread | reel | carousel | article | email
  title TEXT,
  body TEXT NOT NULL,
  media_urls TEXT[],                -- Google Places photo URLs, generated images
  video_url TEXT,                   -- Generated video URL (Shotstack)
  hashtags TEXT[],

  -- Where it came from
  destination TEXT,                 -- Trip destination this content is about
  trip_id UUID,                     -- Source trip
  eval_score INT,                   -- Eval score of the source trip

  -- Workflow
  status TEXT DEFAULT 'draft',      -- draft | approved | scheduled | posted | failed | rejected
  rejection_reason TEXT,            -- Why content-judge rejected it
  scheduled_for TIMESTAMPTZ,        -- When to auto-post
  utm_campaign TEXT,                -- UTM campaign tag

  -- Metadata
  generation_prompt TEXT,           -- What prompt generated this
  model TEXT DEFAULT 'gemini-2.5-flash',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Posted Content ──────────────────────────────────────────
-- Tracks published posts with platform-specific IDs for metrics fetching.
CREATE TABLE growth_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES growth_content(id) ON DELETE CASCADE,

  platform TEXT NOT NULL,
  platform_post_id TEXT,            -- Reddit: t3_xxxxx, Twitter: 123456, etc.
  post_url TEXT,                    -- Direct link to the post
  subreddit TEXT,                   -- Reddit-specific

  posted_at TIMESTAMPTZ DEFAULT now(),
  posted_by TEXT DEFAULT 'system'   -- system | manual
);

-- ─── Engagement Metrics ──────────────────────────────────────
-- Daily metrics snapshot per post. Collected by cron.
CREATE TABLE growth_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES growth_posts(id) ON DELETE CASCADE,

  -- Platform metrics
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  shares INT DEFAULT 0,
  saves INT DEFAULT 0,

  -- Attribution (from GA4 UTM)
  site_visits INT DEFAULT 0,       -- Clicks that reached driftntravel.com
  signups INT DEFAULT 0,           -- New users from this post
  trips_created INT DEFAULT 0,     -- Trips created from this post

  measured_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Growth Learnings ────────────────────────────────────────
-- Patterns discovered by the learning loop. Fed back into content generation.
CREATE TABLE growth_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  category TEXT,                   -- content | timing | platform | format | topic
  insight TEXT NOT NULL,           -- "Reddit trip reports get 3x more signups than tech posts"
  action TEXT,                     -- "Generate more trip reports, fewer tech posts"
  confidence FLOAT DEFAULT 0.5,   -- 0-1, how sure we are
  based_on_posts INT DEFAULT 0,   -- Sample size

  is_active BOOLEAN DEFAULT true,  -- Can be deactivated if outdated
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Growth Runs ─────────────────────────────────────────────
-- Log of each growth cycle execution.
CREATE TABLE growth_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  cycle_type TEXT,                 -- daily | weekly | manual
  status TEXT DEFAULT 'running',   -- running | completed | failed

  content_generated INT DEFAULT 0,
  content_approved INT DEFAULT 0,
  content_rejected INT DEFAULT 0,
  posts_published INT DEFAULT 0,
  emails_sent INT DEFAULT 0,

  metrics_snapshot JSONB,          -- Key metrics at time of run
  learnings_generated INT DEFAULT 0,

  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error TEXT
);
```

### Indexes

```sql
CREATE INDEX idx_growth_content_status ON growth_content(status);
CREATE INDEX idx_growth_content_platform ON growth_content(platform);
CREATE INDEX idx_growth_posts_platform ON growth_posts(platform);
CREATE INDEX idx_growth_metrics_post ON growth_metrics(post_id);
CREATE INDEX idx_growth_learnings_active ON growth_learnings(is_active);
CREATE INDEX idx_growth_runs_status ON growth_runs(status);
```

---

## API Endpoints

### POST /api/growth/generate

Generates content from trip data using Gemini.

**Request:**
```json
{
  "platform": "reddit",
  "contentType": "post",
  "destination": "Istanbul",       // optional — auto-picks best if omitted
  "customPrompt": "...",           // optional — override default prompt
  "count": 3                       // how many pieces to generate
}
```

**Flow:**
1. Query eval system for highest-scoring destinations
2. Load active learnings from `growth_learnings`
3. Pull trip data + items for selected destination
4. Generate content via Gemini with platform-specific formatting
5. Run content-judge validation (real places? accurate prices?)
6. Save to `growth_content` with status `draft` or `approved`

**Response:**
```json
{
  "generated": 3,
  "approved": 2,
  "rejected": 1,
  "items": [
    {
      "id": "uuid",
      "platform": "reddit",
      "title": "3 days in Istanbul — what actually worked",
      "status": "approved",
      "destination": "Istanbul",
      "evalScore": 96
    }
  ]
}
```

### POST /api/growth/video

Generates a short-form video from trip photos.

**Request:**
```json
{
  "destination": "Istanbul",
  "tripId": "uuid",               // optional — auto-picks best
  "style": "slideshow",           // slideshow | highlights | comparison
  "duration": 15,                 // seconds (15, 30, or 60)
  "aspectRatio": "9:16"           // 9:16 (reels/tiktok) | 16:9 (youtube)
}
```

**Flow:**
1. Pull top 5-8 items with Google Places photos from trip
2. Generate text overlays: place name + rating + "Why Drift picked this"
3. Call Shotstack/Creatomate API with photo URLs + text + transitions
4. Get rendered video URL back
5. Save to `growth_content` with `video_url`

**Response:**
```json
{
  "videoUrl": "https://cdn.shotstack.io/...",
  "duration": 15,
  "slides": 6,
  "status": "draft"
}
```

### GET /api/growth/content

Lists content queue with filtering.

**Query params:** `?status=draft&platform=reddit&limit=20`

### PUT /api/growth/content/:id

Update content status (approve, reject, edit, schedule).

**Request:**
```json
{
  "status": "approved",           // or "rejected", "scheduled"
  "scheduledFor": "2026-03-27T10:00:00Z",  // for scheduled posts
  "body": "edited content..."     // for manual edits
}
```

### POST /api/growth/post

Publishes approved content to a platform.

**Request:**
```json
{
  "contentId": "uuid",
  "platform": "reddit",
  "subreddit": "r/travel"         // reddit-specific
}
```

**Flow:**
1. Load content from `growth_content`
2. Verify status is `approved` or `scheduled`
3. Call platform API (Reddit/Twitter/Instagram/TikTok/dev.to)
4. Save platform post ID and URL to `growth_posts`
5. Update content status to `posted`

### GET /api/growth/metrics

Gets engagement metrics across all posts.

**Query params:** `?platform=reddit&days=7`

**Response:**
```json
{
  "totals": {
    "impressions": 12500,
    "clicks": 340,
    "signups": 12,
    "topPost": { "title": "Istanbul trip report", "clicks": 180 }
  },
  "byPlatform": {
    "reddit": { "posts": 5, "clicks": 280, "signups": 10 },
    "twitter": { "posts": 3, "clicks": 60, "signups": 2 }
  },
  "byDestination": {
    "Istanbul": { "posts": 3, "clicks": 200, "signups": 8 },
    "Tokyo": { "posts": 2, "clicks": 80, "signups": 3 }
  }
}
```

### POST /api/growth/learn

Runs the learning cycle — analyzes metrics and generates insights.

**Flow:**
1. Pull all metrics from last 7 days
2. Group by platform, content type, destination, time of day
3. Ask Gemini to identify patterns:
   - "Reddit trip reports vs tech posts — which drives more signups?"
   - "Morning vs evening posts — which gets more engagement?"
   - "Which destinations generate the most click-throughs?"
4. Save insights to `growth_learnings`
5. Deactivate outdated learnings (confidence < 0.3 or based_on < 3 posts)

**Response:**
```json
{
  "newLearnings": 4,
  "deactivated": 1,
  "topInsight": "Reddit trip reports get 3.2x more signups than tech deep-dives"
}
```

---

## Content Generation Templates

### Reddit Trip Report
```
Source: Highest eval-score trip for destination
Format: First-person trip report
Sections: Day-by-day breakdown with specific places + prices
Tone: Experienced traveler sharing tips
CTA: Subtle mention of Drift at the end
UTM: ?utm_source=reddit&utm_medium=post&utm_campaign={dest}_{date}
```

### Twitter Thread
```
Source: Most interesting trip items with high ratings
Format: 5-7 tweet thread
Tweet 1: Hook ("I built an AI that..." or "Just got back from...")
Tweet 2-5: One place per tweet with photo + rating + insight
Tweet 6: How it was planned (Drift mention)
Tweet 7: CTA with link
```

### Instagram Carousel
```
Source: 5-8 best Google Places photos from a trip
Format: Carousel post (up to 10 slides)
Slide 1: Destination name + "X days itinerary"
Slides 2-7: One venue per slide with name + rating overlay
Slide 8: "Plan this trip → link in bio"
Caption: Place names, vibes, CTA
```

### TikTok/Reel Video
```
Source: Trip photos + generated text overlays
Format: 15-30 second vertical video (9:16)
Structure:
  0-2s: Destination name with dramatic zoom
  3-5s: "Day 1" + first venue photo + name overlay
  6-8s: Second venue with rating
  ...
  Last 3s: "Plan this trip" + Drift logo + QR code
Music: Trending royalty-free travel music
```

### Blog Post (dev.to/Medium)
```
Source: Technical architecture or trip data analysis
Format: 1500-2500 words with headers, code snippets, screenshots
Topics:
  - "How we use Gemini to watch travel reels frame by frame"
  - "Building a 96/100 quality itinerary with 8 Google APIs"
  - "Why I built an automated eval for AI-generated travel plans"
Tags: #travel #ai #webdev #nextjs
```

### Email
```
Source: User's trip data or general engagement
Types:
  - Waitlist → Signup conversion
  - Trip follow-up (24h after creation)
  - Reactivation (7 days inactive)
  - Weekly digest (top public trips)
From: Drift <hello@driftntravel.com>
```

---

## Video Generation Service

### Option A: Shotstack ($25/mo starter)
- REST API: send JSON template → get rendered MP4
- Supports: text overlays, transitions, ken burns effect, background music
- Render time: 10-30 seconds for 15s video
- Quality: 1080p
- Integration: single API call with photo URLs + text data

### Option B: Creatomate ($12/mo starter)
- Similar to Shotstack, slightly cheaper
- Template-based: design once, fill with data
- Supports: Instagram/TikTok formats natively

### Option C: FFmpeg (free, self-hosted)
- Run on Railway as a service
- Build video from photos + text overlays via command line
- No external API cost
- Lower quality transitions but free
- More engineering effort

**Recommendation:** Start with Creatomate ($12/mo) — cheapest paid option with good quality. Upgrade to Shotstack if needed. FFmpeg as free fallback.

---

## Automation Schedule

### Daily (10:00 AM IST)
```
1. Metrics collection (5 min)
   - Pull Reddit/Twitter/Instagram engagement for all active posts
   - Pull GA4 UTM data for attribution

2. Content generation (if queue < 3 approved items)
   - Generate 2-3 pieces for today's platform
   - Auto-approve if content-judge passes

3. Publishing
   - Post any scheduled content whose time has arrived
   - Maximum 1 post per platform per day
```

### Weekly (Sunday 8:00 PM IST)
```
1. Learning cycle
   - Analyze last 7 days of metrics
   - Generate insights and update learnings

2. Weekly report
   - Compile metrics into report
   - Save to growth/reports/

3. Next week planning
   - Based on learnings, decide:
     - Which platforms to focus on
     - Which destinations to feature
     - What content formats to try
```

### Monthly
```
1. Deep analysis
   - Full funnel review (landed → signup → trip → booking)
   - Cost per acquisition by channel
   - Content ROI analysis

2. Strategy adjustment
   - Double down on what works
   - Cut what doesn't
   - Test one new channel or format
```

---

## Platform API Setup

### Reddit
```
1. Go to reddit.com/prefs/apps
2. Create "script" app
3. Get client_id + client_secret
4. Env vars: REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD
5. API: OAuth2 → POST /api/submit (type: self)
6. Metrics: GET /api/info?id={fullname} → ups, num_comments
```

### Twitter/X
```
1. Apply at developer.twitter.com
2. Create project + app
3. Get API key, API secret, access token, access token secret
4. Env vars: TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET
5. API: POST /2/tweets (OAuth 1.0a)
6. Metrics: GET /2/tweets/:id?tweet.fields=public_metrics
```

### Instagram (via Meta Graph API)
```
1. Create Facebook App at developers.facebook.com
2. Connect Instagram Business account
3. Get long-lived access token
4. Env vars: META_ACCESS_TOKEN, INSTAGRAM_ACCOUNT_ID
5. API:
   - POST /{account-id}/media (create container)
   - POST /{account-id}/media_publish (publish)
6. Metrics: GET /{media-id}/insights?metric=impressions,reach,engagement
```

### TikTok
```
1. Apply at developers.tiktok.com
2. Create app, request Content Posting API access
3. Get client_key + client_secret
4. Env vars: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET
5. API: OAuth2 → POST /v2/post/publish/video/init
6. Note: Requires user OAuth consent (can't fully automate without user auth)
```

### dev.to
```
1. Go to dev.to/settings/extensions
2. Generate API key
3. Env var: DEVTO_API_KEY
4. API: POST /api/articles (title, body_markdown, tags, published)
5. Metrics: GET /api/articles/{id} → page_views, comments_count, public_reactions_count
```

### Resend
```
1. Sign up at resend.com
2. Add domain driftntravel.com (DNS verification)
3. Get API key
4. Env var: RESEND_API_KEY
5. API: POST /emails (from, to, subject, html)
```

### GA4 Reporting API
```
1. Enable Analytics Data API in GCP Console
2. Create service account with Viewer role on GA4 property
3. Download service account JSON key
4. Env var: GA4_SERVICE_ACCOUNT_KEY (JSON string)
5. API: POST /v1beta/{property}:runReport
6. Query: filter by UTM parameters to attribute signups to posts
```

---

## Cost Summary

| Service | Monthly Cost | What for |
|---------|-------------|----------|
| Gemini API | ~$5-15 (existing) | Content generation |
| Creatomate | $12 | Video generation |
| Reddit API | $0 | Post + metrics |
| Twitter API | $0 | Post + metrics |
| Meta Graph API | $0 | Instagram post + metrics |
| dev.to API | $0 | Blog publishing |
| Resend | $0 (3K/mo free) | Email campaigns |
| GA4 API | $0 | Attribution analytics |
| **Total new** | **$12/mo** | |
| **Total burn** | **$25-45/mo** | Everything including existing infra |

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create Supabase migration for growth tables
- [ ] Build `/api/growth/generate` — content generation from trip data
- [ ] Build `/api/growth/content` — CRUD for content queue
- [ ] Admin dashboard: content generation UI + approval queue
- [ ] Wire Reddit API (OAuth + post + metrics)
- **Deliverable:** Generate content from dashboard, manually post to Reddit

### Phase 2: Auto-Posting (Week 2)
- [ ] Build `/api/growth/post` — publish to platforms
- [ ] Wire Twitter API (OAuth + post)
- [ ] Wire dev.to API (publish articles)
- [ ] Build scheduling system (scheduled_for field + cron check)
- [ ] Admin dashboard: schedule/post buttons, post history
- **Deliverable:** One-click posting to Reddit/Twitter/dev.to from dashboard

### Phase 3: Video & Instagram (Week 3)
- [ ] Wire Creatomate/Shotstack for video generation
- [ ] Build `/api/growth/video` — generate videos from trip photos
- [ ] Wire Meta Graph API for Instagram posting
- [ ] Admin dashboard: video preview + Instagram posting
- **Deliverable:** Generate + post short-form videos to Instagram

### Phase 4: Metrics & Learning (Week 4)
- [ ] Build `/api/growth/metrics` — pull engagement from all platforms
- [ ] Wire GA4 Reporting API for UTM attribution
- [ ] Build `/api/growth/learn` — pattern analysis with Gemini
- [ ] Daily cron job for metrics collection
- [ ] Weekly cron job for learning cycle
- [ ] Admin dashboard: analytics view with charts + learnings
- **Deliverable:** Automated metrics collection + learning loop

### Phase 5: Full Automation (Week 5)
- [ ] Daily cron: generate → approve (auto if judge passes) → post → collect
- [ ] Weekly cron: learn → plan next week → generate
- [ ] Email campaigns via Resend (waitlist, reactivation, digest)
- [ ] TikTok posting (requires user OAuth flow)
- [ ] Admin dashboard: full control panel with override capability
- **Deliverable:** Fully autonomous growth engine

---

## Success Metrics

### Week 1-2 Targets
- 5 Reddit posts published
- 100+ UTM clicks to driftntravel.com
- 10 new signups from organic

### Month 1 Targets
- 20+ posts across 3 platforms
- 500+ UTM clicks
- 50 new signups
- First content performance insights from learning loop

### Month 3 Targets
- 100+ posts, 3+ platforms
- 5,000+ UTM clicks
- 500 signups
- 50+ trips from organic traffic
- First booking click revenue

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Platform bans auto-posting | Start manual (copy-paste), automate gradually. Follow rate limits. |
| Content quality drops | Content-judge validation before every post. Human approval for first 2 weeks. |
| Reddit/social backlash | Genuine value-first content, not promotional. Monitor sentiment. |
| API changes | Abstract platform APIs behind interface. Easy to swap implementations. |
| Cost creep | Weekly cost monitoring. Alert if Gemini/video spend exceeds $50/mo. |

---

*Last updated: March 26, 2026*
