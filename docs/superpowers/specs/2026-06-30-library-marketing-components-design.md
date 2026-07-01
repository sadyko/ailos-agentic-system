# Library Marketing Components (FeatureSections + Hero) — Design Spec

- **Date:** 2026-06-30
- **Status:** Approved for implementation planning
- **Location:** factory repo `ailos-agentic system`, component library at `target/ui/`. Branch `build/library-marketing-components`.
- **What:** Add two marketplace-sourced React/shadcn components to the component library, **adapted to the library's own token system** (no shadcn theme variables, no Radix). Build order: **FeatureSections first, then Hero.**

---

## 1. Intent

The owner pulled two components from a shadcn/marketplace source and wants them in the curated component library. They are written for shadcn (CSS-var theme, sometimes inline color objects) and a generic/branded marketing context. We **adapt** them — not drop them in verbatim — so they share the library's single design language (the existing `brand`/`neutral`/`danger` tokens + the existing `Button`) and meet the library's quality bar (typed, accessible, tested, in the gallery).

## 2. Locked decisions

| Decision | Choice |
|---|---|
| Target | factory library `target/ui/` |
| Reconciliation | **Adapt each component to the library tokens** (no shadcn `--primary`/`--foreground`, no Radix) |
| Scope | **Both** components; FeatureSections first |
| Theme | **Light only** (library has no dark token set — drop the components' dark schemes/`mode` prop) |
| Branding | **De-brand** the FeatureSections (it ships real "Wiza" product copy/mock data) → generic placeholder content |
| Motion | Add **Framer Motion** (`motion`) — both components animate with it (consistent) |
| Quality | Library-grade: prop-driven, typed, frozen acceptance test, `stories`, a `40_DESIGN/COMPONENTS/*.md` card, a gallery entry, behind `npm --prefix target/ui run verify` |

## 3. Shared adaptation rules

- **Token mapping (inline colors → Tailwind tokens):** `purpleAccent → brand-600`, `purpleLight → brand-50/100`, text → `neutral-900/500/400`, borders → `neutral-100`/`line`, surfaces → `white`/`neutral-50`. **Keep functional colors** that carry meaning: LinkedIn blue (`#0077b5`) and the "verified" green stay (semantic), expressed as small local constants or `success` tokens — they are not brand colors.
- **No inline `style={{color:...}}` color objects** — use Tailwind classes bound to the tokens (keeps it themeable/consistent). Small bespoke SVG illustration values may stay inline where Tailwind can't express them.
- **De-brand:** replace "Wiza", real names/emails/companies, and product-specific copy with neutral placeholders (e.g. "Acme", "sample@example.com", generic labels). The illustrative mock cards stay; only the branding/copy changes.
- **New deps in `target/ui`:** `motion` (Framer Motion), `lucide-react` (icons), `clsx` + `tailwind-merge` (a small `cn` helper in `src/lib/cn.ts`), `@fontsource/playfair-display` (FeatureSections title).
- **Animation + SSR/test safety (important):** Framer Motion components render their `initial` (hidden, opacity:0) state in static SSR and don't trigger `whileInView` in jsdom. So:
  - Each component takes an **`animate?: boolean` prop (default `true`)**. When `false`, it renders with no entrance animation (fully visible, no `initial` hidden state).
  - The **gallery `stories` pass `animate={false}`** so the SSR-rendered gallery HTML shows the content visibly.
  - `vitest.setup.ts` gains **`IntersectionObserver` and `matchMedia` mocks** so Framer Motion renders in jsdom without throwing; acceptance tests render with `animate={false}` and assert structure + a11y.
  - Honor `prefers-reduced-motion`: when reduced motion is preferred, behave as `animate={false}`.

## 4. Component 1 — `FeatureSections`

`target/ui/src/components/FeatureSections/FeatureSections.tsx`. A centered header (badge + italic Playfair title) over a responsive 1/2/3-column grid of feature cards; each card = a bespoke mini-mock illustration + title + description. Framer Motion staggered reveal on view.

- **Props:** `badge?: string`, `title?: string` (supports `\n`), `features?: Feature[]` (defaults to the 6 de-branded sample features), `animate?: boolean`.
- **The 6 illustrative cards** (kept, re-themed, de-branded): export/list mock, email-verification mock (with a green "Verified" pill), platform-versions list, enriched-data grid, credits donuts, multi-contact list. All decorative chrome re-themed to tokens; functional green/blue kept.
- **Type:** title in **Playfair Display italic** (self-hosted), via a `font-display-serif` utility or inline class; body in the library's existing UI font.
- **Accessibility:** the section has a heading (`<h2>`); decorative SVGs/icons are `aria-hidden`; mock "data" is presentational; sufficient contrast on real text; no images requiring alt (SVG mocks are decorative).

## 5. Component 2 — `Hero`

`target/ui/src/components/Hero/Hero.tsx`. The "dashboard hero": a badge/eyebrow link, large headline, subtitle, primary + secondary CTAs, and a framed dashboard mockup with a soft radial glow. Framer Motion staggered reveal.

- **Props:** `badge?: string`, `title?: string`, `subtitle?: string`, `primaryCta?: {label, href}`, `secondaryCta?: {label, href}`, `image?: {src, alt}` (defaults to the local mock), `animate?: boolean`.
- **Adaptation:** re-theme to tokens; use the library's **`Button`** (`secondary` for the outline CTA, `primary` for the solid); **lucide-react** icons (phone, arrow); replace the external `storage.efferd.com` screenshots with a **local self-contained SVG dashboard mockup** (`src/components/Hero/dashboard-mock.svg` or an inline SVG component) with proper `alt`/`aria`.
- **Accessibility:** one `<h1>`; CTAs are accessible (real links/buttons with names + visible focus ring); the mock has a text alternative; decorative glow is `aria-hidden`.

## 6. Gallery, cards, gates

- **Stories:** `FeatureSections.stories.tsx` and `Hero.stories.tsx`, each exporting `stories` with `animate={false}` so the gallery renders them statically and visibly.
- **Library cards:** `40_DESIGN/COMPONENTS/FeatureSections.md` and `Hero.md` (purpose, props, usage, a11y notes, gallery link).
- **Gate:** both must pass `npm --prefix target/ui run verify` (`tsc --noEmit` + `vitest run` with jest-axe). The gallery (`npm run gallery`) regenerates entries for both.

## 7. Success criteria

1. `npm --prefix target/ui run verify` is green (tsc + vitest + zero axe violations) with both components' acceptance tests.
2. Both render in the gallery (`40_DESIGN/gallery/FeatureSections.html`, `Hero.html`) **visibly** (animate=false in SSR).
3. Both are prop-driven, token-themed (no shadcn vars, no inline color objects), de-branded, light-only.
4. Library cards exist for both; `npm run gallery` updates `index.html`.
5. Existing `Button` component + its tests still pass (no regression).

## 8. Deferred (YAGNI)

The pasted **Header / navigation-menu** component (Radix navigation-menu + mobile portal — a separate, larger component); dark mode; the original product branding; running these through the autonomous `ui` build profile (these are faithful adaptations of provided code, authored directly then gated, not machine-generated).
