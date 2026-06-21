# Arlo Design System

## Principles

1. **Content-first, restraint over decoration.** Surfaces carry content; chrome disappears. No gradients for decoration, no emoji headers, no clip-art. Inspired by Linear's density and Things 3's calm.
2. **One accent, used sparingly.** Forest green is the brand color. It appears on interactive elements, active states, and progress. Everything else is neutral. Inspired by Stripe's single-accent discipline.
3. **Typography with character.** DM Sans (humanist sans) for UI text — warmer than Inter, still highly legible. DM Serif Display for headings when a moment of personality is needed. One type scale, generous line-height.
4. **Subtle depth, not heavy cards.** Thin borders (`1px`, muted) over drop shadows. When shadows are used, they're small and close. Inspired by shadcn/ui's light touch.
5. **Motion for function, not flair.** Transitions communicate state changes (expand, collapse, enter, exit). Duration 150-200ms. No bouncing logos, no decorative animations.

## Palette

### Light mode
- **Surface:** `#F7F5EF` (warm cream) — background
- **Surface raised:** `#FFFFFF` — cards, popovers
- **Primary (forest green):** `#1F3D2B` — headers, primary buttons, active nav
- **Primary hover:** `#2E5339` — interactive hover state
- **Accent (moss/sage):** `#5B8C5A` — progress bars, success states, links
- **Accent light:** `#E8F0E8` — accent backgrounds, badges
- **Text primary:** `#1A1A1A`
- **Text secondary:** `#6B7280`
- **Text muted:** `#9CA3AF`
- **Border:** `#E5E2DA` (warm gray)
- **Border strong:** `#D1CEC6`
- **Destructive:** `#DC2626`

### Dark mode
- **Surface:** `#0F1A13` (green-tinted near-black)
- **Surface raised:** `#1A2820`
- **Primary:** `#A3C9A8` (light sage — readable on dark)
- **Primary hover:** `#C1DBC4`
- **Accent:** `#5B8C5A`
- **Accent light:** `#1E2E1E`
- **Text primary:** `#EAEAE7`
- **Text secondary:** `#9CA3AF`
- **Border:** `#2A3A2E`

### Radius & spacing
- `--radius`: `0.5rem` (8px) — buttons, cards, inputs
- `--radius-sm`: `0.375rem` (6px) — badges, small elements
- `--radius-lg`: `0.75rem` (12px) — modals, large cards
- Spacing: 4px grid (Tailwind default)

### Shadows
- `--shadow-sm`: `0 1px 2px rgba(0,0,0,0.05)` — subtle lift
- `--shadow-md`: `0 2px 8px rgba(0,0,0,0.08)` — cards on hover
- No heavy drop shadows.

## Typography

- **UI text:** DM Sans 400/500/600/700
- **Display headings:** DM Serif Display 400 (optional, for hero moments)
- **Monospace:** JetBrains Mono (code blocks only)
- **Scale:** 12/14/16/20/24/30/36 — Tailwind's default
- **Line height:** 1.5 for body, 1.2 for headings

## Component conventions

- Buttons: filled primary (forest green), outline secondary, ghost for tertiary
- Inputs: 1px border, warm gray, focus ring in accent green
- Cards: white surface, 1px border, no shadow by default, shadow-sm on hover
- Badges: accent-light background, accent text, rounded-full
- Progress: accent green fill on muted track
- Active nav: primary background, white text
- No purple gradients anywhere
