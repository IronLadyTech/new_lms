# Design System Master — Iron Lady LMS

> **Plugin:** ui-ux-pro-max (persisted)  
> **Brand override:** `COMPANY_CONTEXT.md` wins for colors, fonts, and copy  
> **Page overrides:** `design-system/iron-lady-lms/pages/[page].md`

---

## Pattern

**Dashboard-first LMS** — hero welcome → stat pills → continue + schedule → programs grid → progress.

- **Style:** Vibrant block-based sections with pastel zones (Behance-inspired), Iron Lady red anchor
- **CTA placement:** Primary action in hero; secondary in continue card
- **Sections:** Banner → Hero → Stats → Continue/Schedule → Programs → Announcements → Progress

---

## Color Palette (Iron Lady — authoritative)

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#F52929` | `--il-red` / `--primary` |
| Primary hover | `#D41F1F` | `--il-red-hover` / `--primary-hover` |
| Primary deep | `#C8102E` | `--il-red-deep` |
| Accent / gold | `#F5B301` | `--il-gold` / `--accent` |
| Background (light) | `#F7F6E4` | `--il-cream` / `--bg` |
| Surface | `#FFFFFF` | `--surface` |
| Surface alt | `#EBEADC` | `--il-beige` / `--surface-2` |
| Soft tint | `#F2DEDE` | `--il-pink-soft` |
| Text | `#231F20` | `--il-charcoal` / `--text` |
| Destructive | `#DC2626` | `--danger` |
| Success | `#16A34A` | `--success` |

Program badges: MBW `#C8102E`, LEP `#F5B301`, 100BM `#231F20`

---

## Typography

- **Heading:** Gemunu Libre — `--font-heading`
- **Body:** Fira Sans — `--font-body` / `--font`
- **Mood:** Bold, ambitious, professional leadership (not playful/kids)

---

## Spacing (8px rhythm)

| Token | Value |
|-------|-------|
| `--space-xs` | 4px |
| `--space-sm` | 8px |
| `--space-md` | 16px |
| `--space-lg` | 24px |
| `--space-xl` | 32px |
| `--space-2xl` | 48px |

---

## Components

### Buttons
- Primary: `--primary` bg, white text, Gemunu Libre, 150–200ms hover (brightness, no layout shift)
- Outline: border `--border`, hover border/text `--primary`
- Min height 44px on mobile primary CTAs

### Cards
- Radius `var(--radius)` (12px)
- Border `1px solid var(--border)`
- Hover: `box-shadow` + border-color — **no translateY**

### Inputs
- Min font-size 16px on mobile (prevent iOS zoom)
- Focus: `outline: 2px solid var(--primary)` + offset

### Modals
- Scrim: `rgba(0,0,0,0.5)` minimum
- Close: Lucide `X` icon, `aria-label="Close"`

---

## Anti-patterns

- Emojis as icons
- Generic teal/blue SaaS palette (off-brand)
- Comic/playful fonts
- Layout-shifting hover transforms
- Missing loading states
- Content hidden behind fixed bottom nav

---

## Pre-delivery checklist

- [ ] Lucide icons only
- [ ] `cursor: pointer` on interactives
- [ ] Focus-visible rings
- [ ] Light + dark tested
- [ ] 375px mobile tested
- [ ] Reduced motion respected
- [ ] Skip link to main content
