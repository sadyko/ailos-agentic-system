# Library Marketing Components (FeatureSections + Hero) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two marketplace-sourced React components — a `FeatureSections` grid and a dashboard `Hero` — to the `target/ui` component library, adapted to the library's own design tokens, accessible, tested, and in the gallery.

**Architecture:** React 19 + Vite + TS + Tailwind v4 (`@tailwindcss/vite`, `@theme` tokens in `src/index.css`). The provided shadcn/inline-styled source is **adapted**: inline color objects / shadcn classes → the library's `brand`/`neutral` tokens (functional LinkedIn-blue & "verified" green kept), Framer Motion for entrance animation, an `animate` prop so static SSR/tests render visibly, de-branded placeholder content. Each component ships with a frozen acceptance test (vitest + jest-axe), `stories`, a gallery entry, and a `40_DESIGN/COMPONENTS/*.md` card, all behind `npm --prefix target/ui run verify`.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind v4, Framer Motion (`motion`), lucide-react, Playfair Display (Fontsource), Vitest + @testing-library/react + jest-axe (jsdom).

---

## Conventions
- All work in **`C:\Users\user\Desktop\ailos-agentic system`** (factory repo, branch `build/library-marketing-components`). Run from there; subagents must `cd` in. Use the **Bash** tool.
- The library lives in `target/ui`. Gate command: `npm --prefix target/ui run verify` (`tsc --noEmit && vitest run`). Gallery: `npm --prefix target/ui run gallery`.
- Node validators (`node --test`) at repo root must also stay green.
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **The original source for both components is the code the user pasted in this conversation.** When executing Tasks 2 & 3, the implementer is given that exact source plus the adaptation rules below; it produces the adapted component to satisfy the frozen acceptance test.

## File Structure
```
target/ui/
  package.json                              # + motion, lucide-react, clsx, tailwind-merge, @fontsource/playfair-display  (Task 1)
  vitest.setup.ts                           # + IntersectionObserver & matchMedia mocks                                   (Task 1)
  src/lib/cn.ts                             # cn() helper (clsx + tailwind-merge)                                         (Task 1)
  scripts/build-gallery.tsx                 # page() head gains a Playfair font link                                      (Task 1)
  src/components/FeatureSections/
    FeatureSections.tsx                     # adapted component (Task 2)
    FeatureSections.stories.tsx             # stories, animate={false} (Task 2)
    FeatureSections.acceptance.test.tsx     # frozen contract (Task 2)
  src/components/Hero/
    Hero.tsx                                # adapted component (Task 3)
    DashboardMock.tsx                        # local inline-SVG dashboard mockup (Task 3)
    Hero.stories.tsx                        # stories, animate={false} (Task 3)
    Hero.acceptance.test.tsx                # frozen contract (Task 3)
40_DESIGN/COMPONENTS/FeatureSections.md     # library card (Task 2)
40_DESIGN/COMPONENTS/Hero.md                # library card (Task 3)
```

## Shared adaptation rules (apply to both components)
**Token map (replace inline colors / shadcn classes):**
| Source | → Library |
|---|---|
| `purpleAccent` / `bg-primary` / brand purple | `brand-600` (hover `brand-700`, tint `brand-50`/`brand-100`) |
| `textPrimary` / `text-foreground` | `neutral-900` |
| `textSecondary` / `text-muted-foreground` | `neutral-500` |
| `textMuted` | `neutral-400` (use `neutral-500` if 400 not defined) |
| `cardBackground` / `bg-card` / `bg-background` | `white` / `neutral-50` |
| `borderLight` / `border-input` / `border` | `neutral-100` (hairline) |
| LinkedIn blue `#0077b5`, "verified" green `#22c55e`/bg `#dcfce7`, yellow `#fbbf24` | **kept as-is** (functional) via Tailwind arbitrary values, e.g. `text-[#0077b5]`, `bg-[#dcfce7]` |

**Other rules:**
- Prefer Tailwind classes over `style={{color:...}}`. Bespoke SVG geometry values may stay inline.
- **De-brand:** no "Wiza", no real people/company/emails. Use generic placeholders ("Acme", `sample@example.com`, "Sales Platform", generic person names like "Jordan Lee").
- **`animate?: boolean` prop (default `true`):** when `false` OR `prefers-reduced-motion: reduce`, render with NO entrance animation and NO `initial` hidden/opacity:0 state (fully visible). Stories and tests pass `animate={false}`.
- **Light theme only** — drop the source's dark `mode` / dark color scheme.
- Decorative icons/SVGs get `aria-hidden="true"`; real text keeps AA contrast on its background.

---

### Task 1: Library deps + `cn` util + test mocks + gallery font

**Files:** `target/ui/package.json` (via npm), `target/ui/src/lib/cn.ts`, `target/ui/vitest.setup.ts`, `target/ui/scripts/build-gallery.tsx`.

- [ ] **Step 1: Install dependencies**
```bash
cd "C:/Users/user/Desktop/ailos-agentic system" && npm --prefix target/ui install motion lucide-react clsx tailwind-merge @fontsource/playfair-display
```
Expected: installs succeed; deps recorded in `target/ui/package.json`.

- [ ] **Step 2: Create the `cn` helper `target/ui/src/lib/cn.ts`**
```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 3: Add jsdom mocks to `target/ui/vitest.setup.ts`**

Append to the existing `vitest.setup.ts` (keep the current jest-dom + jest-axe lines):
```ts
import { vi, beforeAll } from 'vitest'

// Framer Motion uses these in jsdom; provide no-op mocks so components render in tests.
beforeAll(() => {
  if (!('IntersectionObserver' in globalThis)) {
    class IO {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return [] }
    }
    // @ts-expect-error assign mock
    globalThis.IntersectionObserver = IO
  }
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  }
})
```

- [ ] **Step 4: Add the Playfair font link to the gallery page head**

In `target/ui/scripts/build-gallery.tsx`, inside the `page()` function's `<head>` (just after the Tailwind CDN script line), add a Playfair Display stylesheet link so gallery pages render the serif title:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,400;1,500&display=swap" rel="stylesheet" />
```
(Concretely: append that string into the head template literal returned by `page()`.)

- [ ] **Step 5: Verify nothing regressed**
Run: `cd "C:/Users/user/Desktop/ailos-agentic system" && npm --prefix target/ui run verify && npm --prefix target/ui run gallery`
Expected: tsc clean; existing Button tests still pass; gallery regenerates (still includes Button).

- [ ] **Step 6: Commit**
```bash
cd "C:/Users/user/Desktop/ailos-agentic system" && git add -A && git commit -m "chore(ui): add motion/lucide/cn deps, framer-motion test mocks, gallery Playfair font"
```

---

### Task 2: `FeatureSections` component (adapted)

**Files:** `src/components/FeatureSections/FeatureSections.{tsx,stories.tsx,acceptance.test.tsx}`, `40_DESIGN/COMPONENTS/FeatureSections.md`.

The component (from the provided source, adapted per the shared rules): a centered header (badge pill + a Playfair-italic `<h2>` title supporting `\n`) over a responsive `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` of 6 cards. Each card = a bespoke mini-mock illustration (kept) + `<h3>` title + description, with a Framer Motion staggered reveal driven by `animate`.

**Props:** `badge?: string`, `title?: string`, `features?: { id: string; title: string; description: string; content: React.ReactNode }[]`, `animate?: boolean` (default `true`). Defaults supply the 6 de-branded sample features.

- [ ] **Step 1: Write the frozen acceptance test**

`src/components/FeatureSections/FeatureSections.acceptance.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { FeatureSections } from './FeatureSections'

describe('FeatureSections (frozen acceptance)', () => {
  it('renders a section heading from the title prop', () => {
    render(<FeatureSections title={'Hello\nworld'} animate={false} />)
    const h2 = screen.getByRole('heading', { level: 2 })
    expect(h2).toBeInTheDocument()
    expect(h2.textContent).toContain('Hello')
  })

  it('renders the badge', () => {
    render(<FeatureSections badge="Test badge" animate={false} />)
    expect(screen.getByText('Test badge')).toBeInTheDocument()
  })

  it('renders six feature cards by default, each with a level-3 title', () => {
    render(<FeatureSections animate={false} />)
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(6)
  })

  it('is de-branded (no "Wiza")', () => {
    const { container } = render(<FeatureSections animate={false} />)
    expect(container.innerHTML.toLowerCase()).not.toContain('wiza')
  })

  it('has zero axe violations (static render)', async () => {
    const { container } = render(<FeatureSections animate={false} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**
Run: `cd "C:/Users/user/Desktop/ailos-agentic system" && npm --prefix target/ui run verify`
Expected: FAIL — `FeatureSections` does not exist.

- [ ] **Step 3: Build `FeatureSections.tsx`**

Adapt the provided source (the `SaaspoFeatureSectionsWiza` component pasted in this conversation) per the **Shared adaptation rules**, specifically:
- Remove the `COLORS`/`ColorScheme` inline objects and the `mode` prop; replace every `style={{color/background/border:...}}` with Tailwind classes bound to the token map (brand/neutral) — except the functional LinkedIn blue / verified green / yellow, kept via arbitrary values.
- Keep all six mock sub-cards (Export, Verification, LinkedIn-versions, Prospect-data, Credits, Contact-points) and their structure; **de-brand** their copy/labels (no "Wiza"/"Sales Navigator→"Sales Platform"", real names→generic, real emails→`sample@example.com`).
- Title `<h2>` uses Playfair Display italic: `className="... font-normal italic"` + `style={{ fontFamily: "'Playfair Display', serif" }}` (acceptable inline use — font, not color).
- Replace Framer Motion `whileInView` orchestration with an `animate`-aware version: if `animate === false` or reduced-motion, render plain (no `initial`/hidden variants); else keep the staggered `whileInView` reveal. Decorative SVGs/icons get `aria-hidden`.
- Export `export function FeatureSections(props) {...}`.

- [ ] **Step 4: Run the acceptance test to green**
Run: `cd "C:/Users/user/Desktop/ailos-agentic system" && npm --prefix target/ui run verify`
Expected: tsc clean; the 5 FeatureSections tests pass (zero axe violations); existing tests still pass.

- [ ] **Step 5: Add `FeatureSections.stories.tsx`**
```tsx
import { FeatureSections } from './FeatureSections'

export const stories = [
  { name: 'Default', element: <FeatureSections animate={false} /> },
]
```

- [ ] **Step 6: Add the library card `40_DESIGN/COMPONENTS/FeatureSections.md`**

Write a card: purpose (a marketing "features" grid), the props table (`badge`, `title`, `features`, `animate`), states/notes (light-only; Framer Motion entrance; consumers must load "Playfair Display" e.g. via `@fontsource/playfair-display`), an accessibility note (decorative mocks are `aria-hidden`), and a usage snippet, plus a link to `../gallery/FeatureSections.html`.

- [ ] **Step 7: Regenerate gallery + verify + commit**
```bash
cd "C:/Users/user/Desktop/ailos-agentic system" && npm --prefix target/ui run gallery && npm --prefix target/ui run verify
```
Expected: `40_DESIGN/gallery/FeatureSections.html` exists and contains the 6 feature titles (visible — animate is off in the story); verify green.
```bash
cd "C:/Users/user/Desktop/ailos-agentic system" && git add -A && git commit -m "feat(ui): FeatureSections component (adapted to tokens, de-branded) + card + gallery"
```

---

### Task 3: `Hero` component (adapted)

**Files:** `src/components/Hero/Hero.tsx`, `src/components/Hero/DashboardMock.tsx`, `src/components/Hero/Hero.{stories,acceptance.test}.tsx`, `40_DESIGN/COMPONENTS/Hero.md`.

The dashboard hero (from the provided `hero-3` source, adapted): an eyebrow/badge link, a large `<h1>`, a subtitle, primary + secondary CTAs (the library `Button`), and a framed dashboard mockup with a soft radial glow; Framer Motion staggered reveal driven by `animate`.

**Props:** `badge?: string`, `title?: string`, `subtitle?: string`, `primaryCta?: { label: string; href: string }`, `secondaryCta?: { label: string; href: string }`, `image?: { src: string; alt: string }` (defaults to the local mock), `animate?: boolean` (default `true`).

- [ ] **Step 1: Write the frozen acceptance test**

`src/components/Hero/Hero.acceptance.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Hero } from './Hero'

describe('Hero (frozen acceptance)', () => {
  it('renders exactly one h1 from the title', () => {
    render(<Hero title="Build better" animate={false} />)
    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0].textContent).toContain('Build better')
  })

  it('renders both CTAs with accessible names', () => {
    render(
      <Hero
        animate={false}
        primaryCta={{ label: 'Get started', href: '#go' }}
        secondaryCta={{ label: 'Book a call', href: '#call' }}
      />,
    )
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /book a call/i })).toBeInTheDocument()
  })

  it('renders the dashboard mock with a text alternative', () => {
    render(<Hero animate={false} />)
    expect(screen.getByRole('img', { name: /dashboard/i })).toBeInTheDocument()
  })

  it('is de-branded (no "efferd")', () => {
    const { container } = render(<Hero animate={false} />)
    expect(container.innerHTML.toLowerCase()).not.toContain('efferd')
  })

  it('has zero axe violations (static render)', async () => {
    const { container } = render(<Hero animate={false} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```
(Note: the library `Button` renders a `<button>`, so CTAs are buttons. The mock has `role="img"` + `aria-label` containing "dashboard".)

- [ ] **Step 2: Run it to confirm it fails**
Run: `cd "C:/Users/user/Desktop/ailos-agentic system" && npm --prefix target/ui run verify`
Expected: FAIL — `Hero` does not exist.

- [ ] **Step 3: Build `DashboardMock.tsx`** — a self-contained inline-SVG "analytics dashboard" mockup (a header bar, a couple of stat cards, a simple line/bar chart), styled with token colors (`brand`/`neutral`), no external URLs. Root element: `<svg role="img" aria-label="Sample product dashboard">…</svg>` (or a wrapping `div role="img" aria-label="Sample product dashboard"`). Keep it lightweight.

- [ ] **Step 4: Build `Hero.tsx`**

Adapt the provided `hero-3` source per the **Shared adaptation rules**:
- Replace shadcn classes/`--theme(...)` gradients with token equivalents (`bg-brand-600`, `text-neutral-900`, `text-neutral-500`, `border-neutral-100`; the radial glow uses a neutral/brand tint via an arbitrary `bg-[radial-gradient(...)]`).
- Use the library `Button` (`import { Button } from '../Button/Button'`): primary CTA → default/`primary` variant; secondary CTA → `secondary` variant. Icons from `lucide-react` (`ArrowRight`, `PhoneCall`), marked `aria-hidden`.
- Replace the external `storage.efferd.com` `<img>`s with `<DashboardMock />` (the local SVG). Default `image` prop is unused when the mock is shown; if `image.src` is provided, render an `<img>` with the given `alt` instead.
- `animate`-aware entrance (same pattern as Task 2): no hidden initial state when `animate===false` or reduced motion.
- One `<h1>` only. Export `export function Hero(props) {...}`.

- [ ] **Step 5: Run the acceptance test to green**
Run: `cd "C:/Users/user/Desktop/ailos-agentic system" && npm --prefix target/ui run verify`
Expected: tsc clean; the 5 Hero tests pass (zero axe); all prior tests still pass.

- [ ] **Step 6: Add `Hero.stories.tsx`**
```tsx
import { Hero } from './Hero'

export const stories = [
  { name: 'Default', element: <Hero animate={false} /> },
]
```

- [ ] **Step 7: Add the library card `40_DESIGN/COMPONENTS/Hero.md`** — purpose, props table, notes (light-only; uses the library `Button` + lucide icons; local SVG mock; Framer Motion entrance), a11y note (one h1, accessible CTAs, mock has a label), usage snippet, link to `../gallery/Hero.html`.

- [ ] **Step 8: Regenerate gallery + verify + commit**
```bash
cd "C:/Users/user/Desktop/ailos-agentic system" && npm --prefix target/ui run gallery && npm --prefix target/ui run verify
```
Expected: `40_DESIGN/gallery/Hero.html` exists and shows the hero (visible); `index.html` lists Button, FeatureSections, Hero; verify green.
```bash
cd "C:/Users/user/Desktop/ailos-agentic system" && git add -A && git commit -m "feat(ui): Hero component (adapted to tokens, local SVG dashboard mock) + card + gallery"
```

---

### Task 4: Final review

- [ ] **Step 1: Full verify + node validators**
Run: `cd "C:/Users/user/Desktop/ailos-agentic system" && npm --prefix target/ui run verify && node --test`
Expected: all green.

- [ ] **Step 2: Confirm gallery shows all three components visibly**
Run: `cd "C:/Users/user/Desktop/ailos-agentic system" && ls 40_DESIGN/gallery/ && grep -l "Playfair" 40_DESIGN/gallery/FeatureSections.html`
Expected: `Button.html`, `FeatureSections.html`, `Hero.html`, `index.html` present; FeatureSections page references the Playfair font.

- [ ] **Step 3: Dispatch a final code-quality review** (per subagent-driven-development) over the branch diff — focus: token-only theming (no leftover shadcn vars/inline color objects), de-branding complete, a11y (headings, aria-hidden on decorative, AA contrast, CTA names), the `animate=false` SSR path renders visibly, no regression to Button. Address findings, re-verify.

---

## Self-Review (plan author)

**Spec coverage:** §2 decisions → all tasks; §3 adaptation rules → the shared-rules block + Tasks 2/3 step "Build"; §4 FeatureSections → Task 2; §5 Hero → Task 3 (+ DashboardMock); §6 gallery/cards/gates → each component's steps + Task 4; §7 success criteria → acceptance tests + Task 4; §8 deferred (Header, dark mode) → not built.

**Placeholder scan:** The component *bodies* in Tasks 2/3 are produced by adapting the user-provided source against the shared rules + the full frozen acceptance tests (the contract is fully specified here; the source is in-conversation). This is a deliberate choice for adapting ~800 lines of provided code, not hand-waving — every other file (cn.ts, test mocks, tests, stories) has complete code, and the gate (tsc + jest-axe + the assertions, incl. the de-brand and one-h1 checks) objectively verifies the result.

**Type/name consistency:** Component exports `FeatureSections` and `Hero` (named) — matches the test imports and the `stories` imports. `animate` prop name is identical across components, stories, and tests. `cn` from `src/lib/cn.ts`. `Button` imported from `../Button/Button` (the existing component). Gallery stories use `export const stories` matching the existing `build-gallery.tsx` auto-discovery convention. Gate command `npm --prefix target/ui run verify` identical throughout.
```
