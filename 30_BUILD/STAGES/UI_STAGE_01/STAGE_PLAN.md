# STAGE_01 Plan

## Goal
Build an accessible, production-grade **Button** React component into the library at `target/ui/src/components/Button/Button.tsx` using design tokens only (no off-token values). The component supports `variant` (`'primary' | 'secondary' | 'ghost'`, default `'primary'`), `size` (`'sm' | 'md'`, default `'md'`), and `loading` (boolean — shows a busy state, sets `aria-busy="true"`, disables interaction), plus all native `<button>` attributes. It must use native `<button>` semantics with an always-present accessible name, a visible (non-removed) focus ring, distinct hover/focus/disabled states, tokens-only styling, and no leftover markers. The definition of done is the frozen acceptance suite at `target/ui/src/components/Button/Button.acceptance.test.tsx` (which must not be modified). Also write `Button.stories.tsx` (all states) and the library card `40_DESIGN/COMPONENTS/Button.md`.

## STEPs

### STEP_01 — Implement accessible Button component (+ stories + library card)
- Files:
  - `target/ui/src/components/Button/Button.tsx`
  - `target/ui/src/components/Button/Button.stories.tsx`
  - `40_DESIGN/COMPONENTS/Button.md`
- Acceptance criteria:
  - Renders a native `<button>` element (`tagName === 'BUTTON'`) whose accessible name is its children, resolvable via `getByRole('button', { name: 'Save' })` (maps to `renders a native button with its accessible name`)
  - Supports all 6 `variant` x `size` combinations (`variant`: primary | secondary | ghost; `size`: sm | md), each rendering exactly one button so 6 instances render 6 buttons (maps to `renders all variant x size combinations`)
  - Forwards native `<button>` attributes including `disabled`, so a `disabled` button is reported as disabled (maps to `is disabled when disabled`)
  - When `loading` is true, sets `aria-busy="true"` and disables interaction (button is disabled) (maps to `is busy and non-interactive when loading`)
  - Has zero axe accessibility violations across primary/secondary/ghost variants and disabled/loading states: always-present accessible name, visible focus ring not removed, distinct hover/focus/disabled states, tokens-only styling (brand/neutral/danger, token radius), and no leftover markers (maps to `has zero axe violations across variants and states`)
  - `Button.stories.tsx` covers all variant x size combinations and the disabled and loading states
  - `40_DESIGN/COMPONENTS/Button.md` documents the component (props, variants, sizes, states, tokens used)
