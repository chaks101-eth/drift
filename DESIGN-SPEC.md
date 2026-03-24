# Drift - Mobile App Design Specification

## Design Reference Screenshots
All polished design screens are exported as 2x PNGs in `public/design-reference/`:
- `01-hero.png` - Hero/splash screen
- `02-login.png` - Login screen
- `03-origin-step1.png` - Origin city selection (Step 1)
- `04-dates-step2.png` - Date picker (Step 2)
- `05-budget-step3.png` - Budget & travelers (Step 3)
- `06-vibes-step4.png` - Travel vibes swipe (Step 4)
- `07-destination-picker.png` - Destination selection
- `08-loading.png` - Loading/processing screen
- `09-board-itinerary.png` - Trip board/itinerary
- `10-explore.png` - Explore tab
- `11-trips.png` - Your Trips tab
- `12-profile.png` - Profile tab

## Color Palette (Dark Theme)
- **Background**: `#08080c` (near-black)
- **Surface/Card**: `#0e0e14` (dark surface)
- **Gold Primary**: `#c8a44e` (accent, CTAs, active states)
- **Gold Gradient**: `linear-gradient(135deg, #c8a44e, #8B7845)`
- **Gold Transparent**: `#c8a44e14` (tags, badges background)
- **Gold Border**: `#c8a44e33` (subtle gold borders)
- **Text Primary**: `#f0efe8` (off-white)
- **Text Secondary**: `#7a7a85` (muted gray)
- **Text Tertiary**: `#4a4a55` (very muted)
- **Text Dim**: `#5a5a65` (dimmed labels)
- **Border Subtle**: `#ffffff0A` to `#ffffff14` (white alpha)
- **Surface Subtle**: `#ffffff05` to `#ffffff08` (white alpha fills)
- **Destructive**: `#e74c3c` (sign out, errors)

## Typography
- **Headlines**: Playfair Display (serif, elegant)
  - Screen titles: 28px, weight 600
  - Card titles: 26-30px, weight 500-600
  - Stat values: 20-24px, weight 700
- **Body/UI**: Inter (sans-serif, clean)
  - Body text: 13-14px, weight 400-500
  - Labels/meta: 11-12px, weight 400-500
  - Section headers: 10-11px, weight 600-700, letter-spacing 2-3px, uppercase
  - Tab labels: 10px, weight 500-600, letter-spacing 0.5px, uppercase
  - Tags: 9-11px, weight 500-600
- **Status bar time**: SF Pro / Inter fallback, 15px, weight 600

## Spacing & Layout
- **Screen size**: 390 x 844 (iPhone 14/15)
- **Screen corner radius**: 20px
- **Content padding**: 20-24px horizontal
- **Section gaps**: 20-28px
- **Card corner radius**: 16-18px
- **Button corner radius**: 14-16px (standard), 999px (pills)
- **Status bar height**: 62px

## Component Patterns

### Bottom Tab Bar (Pill Style)
- Container: full width, padding `[12, 21, 21, 21]`
- Pill: height 62px, corner-radius 36px, fill `#0e0e14`, border `#ffffff14`
- Inner padding: 4px
- Tab items: fill_container width, corner-radius 26px
- Active: fill `#c8a44e`, icon/text `#08080c`
- Inactive: transparent, icon/text `#4a4a55`
- Icons: 18px lucide, Labels: 10px uppercase

### Back Button
- Simple icon: lucide `arrow-left`, 20px, fill `#f0efe8`
- No frame/border wrapper

### Cards
- Fill: `#0e0e14`
- Border: `#ffffff0A` to `#ffffff0F`, 1px inside
- Corner radius: 16-18px
- Padding: 14-16px

### Chips/Tags
- Corner radius: 10-20px (pill)
- Fill: `#c8a44e14` (gold tint) or `#ffffff0a`
- Border: `#ffffff14` or `#c8a44e33`
- Text: 9-11px Inter

### Input Fields
- Corner radius: 14px (standard) or 999px (pill search)
- Border: `#ffffff14`, 1px inside
- Background: transparent or `#0e0e14`

### Buttons (CTA)
- Gold CTA: fill `#c8a44e`, text `#08080c`, corner-radius 14-16px, height 52-56px
- Ghost CTA: fill `#c8a44e30`, border `#c8a44e40`, corner-radius 14px

### Step Counter
- Text: Inter 13px, weight 500, fill `#5a5a65`
- Format: "1 / 4" or "01 / 04"
