# shadcn-native Component Library — Design Spec

- **Date:** 2026-07-01
- **Status:** Approved for implementation planning
- **Location:** factory repo `ailos-agentic system`, component library `target/ui/`. Branch `build/shadcn-native`.
- **Why:** To reach real breadth (dozens → eventually hundreds of components), the library adopts **shadcn/ui conventions** so components can be pulled via the shadcn CLI/registry instead of hand-adapted one by one.

---

## 1. Core principle — the theme comes from the PROJECT, never from shadcn

**shadcn is only the source of component *code*. The *look* (palette, radius, typography, mode) is always derived from the specific project's identity, function, and domain — never shadcn's generic defaults.** Components read CSS variables (`--primary`, `--background`, `--foreground`, `--card`, `--border`, …); re-theming per product is swapping those variable values.

This is codified as a durable instruction (deliverable of this slice):
- `40_DESIGN/THEMING.md` — the rule + how to derive a palette per project.
- A line in `CLAUDE.md` (already says "set brand tokens first"; extended to cover shadcn theming).
- A saved memory ([[ui-no-emojis-professional]] sibling).

**Domain guardrails (examples, not exhaustive):**
- **Medical / health:** no harsh pure-black/pure-white or moody dark themes; use calm, clean, trustworthy palettes (soft clinical blues/greens/teals), generous whitespace, high legibility.
- **Finance:** trust + precision (deep blues/greens, restrained).
- Match the palette to the product's name/function/audience. When unsure, ask the owner for brand colors/references before building.
- **Dark mode is opt-in per project, not assumed.** shadcn ships a `.dark` block; only enable it when the product wants it.

## 2. Locked decisions

| Decision | Choice |
|---|---|
| Library convention | **shadcn-native** (shadcn CLI/registry + CSS-variable theme + Radix + cva) |
| Theme source | **Project-derived tokens mapped into shadcn variables** — never shadcn's default palette |
| Library's own default | The existing **blue brand** (`#2b54e6`) as a neutral placeholder, mapped to `--primary`; documented as override-per-product |
| Dark mode | **Opt-in per project** (not enabled by default in the library) |
| Existing 3 components | **Coexist** (Button/Hero/FeatureSections keep their custom tokens; new work is shadcn). `brand`/`neutral` `@theme` tokens stay defined so they keep rendering. |
| First batch | **~15 core components** (see §5) |
| Gate | `npm --prefix target/ui run verify` (tsc + vitest + jest-axe smoke per component) + gallery entry per component |

## 3. The conversion (setup)

1. **Path alias `@/*` → `src/*`:** add to `tsconfig.app.json` (`baseUrl` + `paths`) and `vite.config.ts` (`resolve.alias`), and to the vitest config (so tests resolve `@/`). shadcn imports (`@/components/ui/...`, `@/lib/utils`) depend on it.
2. **`cn` at `@/lib/utils`:** shadcn expects `@/lib/utils`. Re-export the existing `cn` there (keep `src/lib/cn.ts` or move it) so both the existing components and shadcn components share one `cn`.
3. **`components.json`:** shadcn config — style (default/new-york), `tailwind.cssVariables: true`, `tailwind.baseColor`, the aliases, `iconLibrary: lucide`.
4. **`shadcn init`** (Tailwind v4 / React 19 / Vite path) — writes the shadcn variable theme into `src/index.css` (`:root` + `.dark`, `@theme inline` mapping vars → color utilities) and installs `tw-animate-css` (v4) + `class-variance-authority`. **After init, restore the `brand`/`neutral` `@theme` tokens** (so the 3 existing components still resolve) and **set `--primary` (and ring/accent as appropriate) to the brand blue.**
5. Per-component Radix deps come in automatically when `shadcn add <name>` runs.

Setup is verification-driven: it is "done" when `shadcn add button` produces a component that renders in a smoke test and the gallery, and `npm run verify` is green.

## 4. Gallery & tests for shadcn components

- **Gallery:** reuses the compiled-Tailwind-inlined generator (fixed earlier). shadcn components are client components (Radix); the gallery SSR-renders their **default/closed/trigger** state (a Dialog shows its trigger button, not the open modal) — acceptable for a static preview. Each component gets a `stories.tsx` exporting a representative default (and a couple of variants where cheap).
- **Smoke test per component** (`<name>.smoke.test.tsx`): renders the default example, asserts it mounts without throwing, and **zero jest-axe violations** on the default. (Interactive open-states are out of scope for the smoke gate.) The jsdom mocks added earlier (IntersectionObserver/matchMedia) plus any Radix needs (`ResizeObserver`, `hasPointerCapture`, `scrollIntoView`) are shimmed in `vitest.setup.ts` as needed.

## 5. First batch (~15 core components)

`button, card, input, label, textarea, select, checkbox, switch, badge, tabs, dialog, tooltip, separator, avatar, alert`.

Each: `shadcn add <name>` → a `stories.tsx` default example → a `smoke.test.tsx` → confirm it appears in the gallery. (These live under `src/components/ui/` per shadcn convention; the existing custom components stay under `src/components/<Name>/`.)

## 6. Batching the rest (process, not this slice)

A repeatable step documented in `40_DESIGN/THEMING.md` / a short `docs` note: for each additional component — `shadcn add <name>`, write a default `stories.tsx`, write a `smoke.test.tsx`, run `verify` + `gallery`, commit. Run ~15 per follow-up slice to cover the remaining ~62 shadcn components, then community registries (Aceternity, Magic UI, 21st.dev, blocks) push toward the hundreds. Each registry addition is re-themed via the project variables (§1).

## 7. Success criteria

1. `shadcn init` completed; `@/*` alias works; `cn` at `@/lib/utils`; `components.json` present.
2. `src/index.css` has the shadcn variable theme with **`--primary` = the brand blue**, the `brand`/`neutral` tokens preserved, and **no dark mode active by default** (the `.dark` block may exist but is not applied).
3. The ~15 batch components are added under `src/components/ui/`, each with a story + smoke test; all pass `npm --prefix target/ui run verify` (tsc + vitest + jest-axe).
4. The gallery shows the ~15 new components (+ the existing 3) rendering with the project palette (not shadcn's default gray).
5. `40_DESIGN/THEMING.md` exists (the project-theme rule + domain guardrails + the batching process); `CLAUDE.md` references it; a memory is saved.
6. No regression: the existing Button/Hero/FeatureSections + their tests still pass.

## 8. Deferred (YAGNI)

The remaining ~62 shadcn components (follow-up batches); community-registry components; migrating the 3 existing custom components onto shadcn primitives; full dark-mode theming; visual-regression testing of interactive open-states.
