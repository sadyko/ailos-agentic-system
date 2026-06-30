# STEP_01 Output — Accessible Button component (+ stories + library card)

Role: DESIGNER. Implemented an accessible, token-styled `Button` and made the
frozen acceptance test pass **unchanged**.

## Files changed

- `target/ui/src/components/Button/Button.tsx` — the component (created)
- `target/ui/src/components/Button/Button.stories.tsx` — gallery stories (created)
- `40_DESIGN/COMPONENTS/Button.md` — library card / docs (created; created the `40_DESIGN/COMPONENTS/` dir)

Generated as a side effect of `npm run gallery` (not authored by hand):
`40_DESIGN/gallery/Button.html` and updated `40_DESIGN/gallery/index.html`.

## API (matches the frozen contract)

- Named export `Button` from `./Button` (not default).
- `extends React.ButtonHTMLAttributes<HTMLButtonElement>`; native attrs spread onto the element.
- Props: `variant: 'primary'|'secondary'|'ghost'` (default `primary`), `size: 'sm'|'md'` (default `md`), `loading`, native `disabled`.
- Defaults `type="button"` (overridable) to avoid accidental form submission.
- `loading` ⇒ `aria-busy="true"` + element disabled (non-interactive); shows an `aria-hidden` spinner while keeping the visible label.

## Acceptance criteria → how satisfied

1. **renders a native button with its accessible name** — renders a real `<button>` (`tagName === 'BUTTON'`); `children` are the only label, so `getByRole('button', { name: 'Save' })` resolves. ✅
2. **renders all variant x size combinations** — single `<button>` per render; 3 variants × 2 sizes = 6 buttons. ✅
3. **is disabled when disabled** — native `disabled` is forwarded to the element. ✅
4. **is busy and non-interactive when loading** — sets `aria-busy="true"` and computes `disabled = disabled || loading`, so the loading button is `:disabled`. ✅
5. **zero axe violations across variants/states** — always-present accessible name (label never removed), single root element with no duplicate ids, valid native markup, spinner is `aria-hidden`. Verified by `jest-axe` over primary/secondary/ghost/disabled/loading rendered together. Visible focus ring (`focus-visible:ring-2 ring-brand-500` + offset, never removed); distinct hover/active/disabled states; tokens-only styling (brand/neutral scales, `rounded-md`); no leftover markers (no TODO/FIXME/placeholder/debug). ✅
6. **stories cover all combos + disabled + loading** — `stories` exports 6 combo cards plus `disabled` and `loading` (8 total), in the bespoke `{ name, element }[]` shape consumed by `scripts/build-gallery.tsx`. ✅
7. **Button.md documents the component** — purpose, anatomy, props table, variants, sizes, states, a11y notes, tokens used, usage snippet, and links to the code + `../gallery/Button.html`. ✅

## Styling / tokens

Tokens-only Tailwind utility strings backed by `src/tokens.ts`:
colors `brand` 50/100/500/600/700, `neutral` 50/100/300/900, radius `rounded-md`.
No off-token colors/radius. (No Tailwind build in app/test toolchain — classes
are plain strings; only the gallery resolves them via the CDN config injected
from `tokens.ts`. Tests assert roles/attrs/axe only.)

## Toolchain note (why the `@jsxRuntime automatic` pragma)

`tsx ./scripts/build-gallery.tsx` (the gallery / "library card" builder) resolves
the repo's root `tsconfig.json`, which uses project **references** with
`files: []` and therefore exposes no `jsx` option to esbuild — so tsx defaults to
the *classic* JSX runtime and throws `ReferenceError: React is not defined` when
rendering JSX (the app never imports React, per `jsx: react-jsx`). To keep
idiomatic JSX and avoid editing any frozen/shared config, `Button.tsx` and
`Button.stories.tsx` carry a `/** @jsxRuntime automatic */` pragma. This forces
the automatic runtime under tsx while remaining a no-op for tsc + vitest (which
already use `react-jsx`). No shared/frozen files were modified.

## Verification (evidence)

- `npm run verify` (= `tsc --noEmit && vitest run`): **Test Files 2 passed (2), Tests 7 passed (7)**; tsc clean.
- `npm run gallery`: `gallery: wrote 1 component page(s)`; `Button.html` contains the token classes, `aria-busy="true"` (loading) and `disabled=""` (disabled); `index.html` links to `./Button.html`.
- `npx oxlint src/components/Button/`: no issues.

No frozen acceptance test was modified.
