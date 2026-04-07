# Desktop Board — Design Spec from Prototype

> Source: `/Users/mac/Desktop/travel/desktop.html`
> This is the blueprint for the desktop trip board. The current implementation at `src/components/desktop/BoardView.tsx` needs to be rewritten to match this.

## Layout Architecture

```
┌─────────────────────────────────────────────────────────┐
│  NavBar: "Bali, Indonesia" · Apr 12-18 · 2 pax         │
│          [Share] [Book] [Close]                          │
├───┬─────────────────────────────────────────────────┬───┤
│64 │  Main Scrollable Board                          │   │
│px │                                                 │   │
│   │  ┌─ AI Insight Bar (dismissible) ─────────────┐│   │
│B  │  │ "Here's what I considered building this..." ││   │
│O  │  │ Pills: Timing | Route | Budget | Vibe      ││   │
│A  │  └────────────────────────────────────────────┘│   │
│R  │                                                 │   │
│D  │  ┌─ Trip Brief ──────────────────────────────┐ │   │
│   │  │ Drift's Reasoning + vibes + stats         │ │   │
│E  │  └──────────────────────────────────────────┘ │   │
│X  │                                                 │   │
│P  │  ┌─ Day 1 — Saturday, April 12 — Arrival ───┐ │   │
│L  │  │ fc-lane-header (dot + label + date + line)│ │   │
│O  │  │                                           │ │   │
│R  │  │ ┌─────────┐    ┌─────────┐    ┌────────┐ │ │   │
│E  │  │ │ Flight  │ ─→ │ Hotel   │ ─→ │ Dinner │ │ │   │
│   │  │ │ (wider) │    │ (teal)  │    │        │ │ │   │
│P  │  │ └─────────┘    └─────────┘    └────────┘ │ │   │
│R  │  │                                           │ │   │
│O  │  │ "Drift chose a daytime routing..."       │ │   │
│F  │  └──────────────────────────────────────────┘ │   │
│I  │                                                 │   │
│L  │  ┌─ Day 2 — Sunday, April 13 — Ubud ────────┐ │   │
│E  │  │ ... more flowchart nodes ...              │ │   │
│   │  └──────────────────────────────────────────┘ │   │
│   │                                                 │   │
│   │  ┌─ Cost Bar ────────────────────────────────┐ │   │
│   │  │ Flights $1,240 | Hotels $1,850 | ...      │ │   │
│   │  │                          Total: $4,695    │ │   │
│   │  └──────────────────────────────────────────┘ │   │
│   │                                                 │   │
│   │  ┌─ Trip Summary ───────────────────────────┐  │   │
│   │  │ Breakdown rows                           │  │   │
│   │  └──────────────────────────────────────────┘  │   │
└───┴─────────────────────────────────────────────────┘───┘
                                              💬 Chat FAB
```

## Thin Sidebar (64px icon rail)

```css
.brd-sidebar {
  width: 64px;
  border-right: 1px solid var(--glass2);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
  gap: 6px;
  background: rgba(6,6,8,.6);
}
```

Icons (44x44 each):
1. **Board** (grid icon) — active by default
2. **Explore** (compass icon) — discover more places
3. **AI** (chat icon) — opens chat panel
4. **Profile** (user icon) — settings/profile
5. **Spacer**
6. **Send** (airplane icon) — quick chat trigger

Each icon has:
- Active state: gold color + left border accent (3px gold bar)
- Hover: subtle bg highlight
- Label: 7px uppercase below icon

**On mobile (< 1024px): sidebar is hidden**

## Flowchart Board (`.brd-scroll`)

### Header (`.brd-head`)
- Trip title (serif)
- Meta: dates · travelers · days
- Action buttons: Share, Book, Close

### AI Insight Bar (`.ai-insight-bar`)
- Gold gradient background
- Drift icon (circle with send icon)
- Title + descriptive text
- Insight pills: Timing, Route, Budget, Vibes
- Dismiss button (×)

### Trip Brief (`.trip-brief`)
- Drift avatar + "Drift's Reasoning" label
- Strategy text (bold keywords)
- Vibe tags (rounded pills)
- Stats: Nights | Experiences | Est. Cost | Vibe Match %

### Flowchart Lanes (`.fc-lane`)

Each day is a "lane":
```html
<div class="fc-lane" data-day="1">
  <div class="fc-lane-header">
    <div class="fc-lane-dot"></div>     <!-- Gold dot -->
    <div class="fc-lane-label">Day 1</div>
    <div class="fc-lane-date">Saturday, April 12 — Arrival</div>
    <div class="fc-lane-line"></div>     <!-- Horizontal line -->
  </div>
  <div class="fc-flow">
    <!-- Nodes go here -->
  </div>
</div>
```

### Flowchart Nodes (`.fc-node`)

Standard node (220px wide):
```css
.fc-node {
  width: 220px;
  border-radius: 16px;
  background: rgba(8,8,12,.95);
  border: 1px solid rgba(255,255,255,.06);
  overflow: hidden;
  cursor: pointer;
  transition: all .4s;
}
.fc-node:hover {
  border-color: rgba(200,164,78,.3);
  transform: translateY(-4px);
  box-shadow: 0 16px 48px rgba(0,0,0,.5);
}
```

Node structure:
- Image (full width, 120px height)
- Content padding (14px)
- Category tag (gold icon + label)
- Name (serif, 16px)
- Meta (12px, text3)
- Price (gold, 14px, bold)
- Tags (small pills)
- Reason bar (gold gradient bg, border-left gold)
- 3-dot menu (appears on hover, absolute top-right)

### Special Node Types

**Flight (`.fc-flight`, 280px wide)**:
- Gold border accent
- Route display: departure code → line with arrow → arrival code
- Duration, airline, tags

**Hotel (`.fc-hotel`, 250px wide)**:
- Teal/green border accent
- Feature pills (Rice Terrace View, Spa, etc.)

### Arrows Between Nodes (`.fc-arrow`)

```css
.fc-arrow {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  opacity: .3;
}
.fc-arrow-line {
  width: 32px;
  height: 2px;
  background: linear-gradient(to right, rgba(200,164,78,.5), rgba(200,164,78,.15));
  position: relative;
}
/* Arrow head */
.fc-arrow-line::after {
  border-left: 5px solid rgba(200,164,78,.3);
  border-top: 3.5px solid transparent;
  border-bottom: 3.5px solid transparent;
}
```

Has a "+" button (`.fc-arrow-add`) that appears on hover to add a stop between items.

### Day Connectors (`.fc-down`)

Between days — vertical gold line + label:
```css
.fc-down-line {
  width: 2px;
  height: 32px;
  background: linear-gradient(to bottom, var(--gold), var(--glass2));
}
.fc-down-label: "Next morning" (9px, uppercase)
```

### Cost Bar (`.cost-bar`)

```
Flights $1,240 | Hotels $1,850 | Activities $385 | Food $420 | Transfers $180
                                                    Total: $4,695
```

### Trip Summary (`.trip-sum`)

Detailed breakdown rows with serif total in gold.

## Detail Modal (Airbnb-style)

```css
.det-inner {
  grid-template-columns: 400px 1fr;
  max-height: 85vh;
  max-width: 920px;
  border-radius: 24px;
}
```

Left: Full-height image with category badge
Right: Scrollable content:
- Category type (10px uppercase gold)
- Title (serif, 32px)
- Location
- Stats grid (4 cols: Rating, Duration, Price Level, Best Time)
- Description
- Highlights/features pills
- "Why This" box (gold gradient, with vibe tags)
- Alternatives carousel (200px cards with swap button)
- Action buttons: Keep This | Ask Drift AI

## Chat Panel (slide-in from right)

```css
.chat {
  position: fixed;
  right: 0; top: 0; bottom: 0;
  width: 440px;
  background: rgba(6,6,8,.96);
  backdrop-filter: blur(30px);
  border-left: 1px solid var(--glass2);
  transform: translateX(100%);  /* slides in */
}
```

## Chat FAB (floating button)

```css
.chat-fab {
  position: fixed;
  bottom: 32px; right: 32px;
  width: 56px; height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--gold), #debb6a);
  box-shadow: 0 8px 32px rgba(200,164,78,.35);
}
```
Has pulse animation ring.

## Typography Mapping (prototype → Drift)

| Prototype | Drift Mobile | Use |
|-----------|-------------|-----|
| Cormorant Garamond | Playfair Display | Headings, prices, day labels |
| Montserrat | Inter | Body, labels, meta |
| --gold: #c8a44e | drift-gold | Primary accent |
| --bg: #060608 | drift-bg (#08080c) | Background |
| --text: #f0efe8 | drift-text | Primary text |
| --text2: rgba(f0efe8,.6) | drift-text2 | Secondary text |
| --text3: rgba(f0efe8,.35) | drift-text3 | Tertiary text |
| --glass: rgba(255,255,255,.04) | drift-surface | Card backgrounds |

## Key Interactions from Prototype

1. **Node hover**: lift + glow + show 3-dot menu
2. **Node click**: opens detail modal (not navigation)
3. **Arrow hover**: shows "+" button to add stop
4. **3-dot menu**: Alternatives, Ask Drift, Set Price Alert
5. **Detail modal**: grid layout, image left, content right, swap alternatives inline
6. **Chat FAB pulse**: 3s infinite pulse ring animation
7. **Day lane header**: gold dot + label + date + horizontal line
8. **Scroll reveal**: items fade in on scroll

## Files to Modify

- `src/components/desktop/BoardView.tsx` — full rewrite to match flowchart layout
- `src/components/desktop/ItemCard.tsx` — rewrite as `.fc-node` style
- `src/components/desktop/FlightCard.tsx` — rewrite as `.fc-flight` style
- New: `src/components/desktop/DetailModal.tsx` — Airbnb-style centered modal
- `src/components/desktop/ChatPanel.tsx` — already close, minor updates
- `src/app/trip/[id]/page.tsx` — add thin sidebar option
