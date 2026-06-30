# UI STAGE Goal — Button

Build an accessible, production-grade **Button** React component into the library at
`target/ui/src/components/Button/Button.tsx` (using the design tokens; no off-token values).

Props:
- `variant`: `'primary' | 'secondary' | 'ghost'` (default `'primary'`)
- `size`: `'sm' | 'md'` (default `'md'`)
- `loading`: boolean — shows a busy state, sets `aria-busy="true"`, and disables interaction
- plus all native `<button>` attributes (incl. `disabled`, `onClick`, `type`)

Requirements:
- Native `<button>` semantics; an accessible name always present; visible focus ring (not removed).
- Tokens only (brand/neutral/danger, token radius). Distinct hover/focus/disabled states.
- No leftover markers.

The definition of done is the frozen acceptance suite at
`target/ui/src/components/Button/Button.acceptance.test.tsx` (do NOT modify it).
Also write `Button.stories.tsx` (all states) and the library card `40_DESIGN/COMPONENTS/Button.md`.
