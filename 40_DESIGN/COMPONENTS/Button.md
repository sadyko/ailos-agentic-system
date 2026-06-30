# Button

Primary interactive control for triggering an action. Renders a native
`<button>`, so it is keyboard-operable, focusable, and announced as a button by
assistive technology out of the box.

- Source: [`../../target/ui/src/components/Button/Button.tsx`](../../target/ui/src/components/Button/Button.tsx)
- Stories: [`../../target/ui/src/components/Button/Button.stories.tsx`](../../target/ui/src/components/Button/Button.stories.tsx)
- Gallery: [`../gallery/Button.html`](../gallery/Button.html)

> **Note:** The gallery preview (`../gallery/Button.html`) is rendered with Tailwind via CDN for offline viewing; the app itself is styled by the real Tailwind build in `target/ui`.

## Anatomy

```
<button>            native, keyboard + a11y
  [spinner]         shown only when loading (aria-hidden)
  <span>label</span>  the accessible name (children)
</button>
```

The accessible name is always the `children`, so the button is never nameless —
even while loading the label text remains in the DOM.

## Props

The component extends `React.ButtonHTMLAttributes<HTMLButtonElement>`, so every
native button attribute (`onClick`, `name`, `form`, `aria-*`, `data-*`, …) is
forwarded.

| Prop       | Type                                   | Default     | Description                                                        |
| ---------- | -------------------------------------- | ----------- | ----------------------------------------------------------------- |
| `variant`  | `'primary' \| 'secondary' \| 'ghost'`  | `'primary'` | Visual emphasis.                                                  |
| `size`     | `'sm' \| 'md'`                         | `'md'`      | Height / padding / type scale.                                    |
| `loading`  | `boolean`                              | `false`     | Shows a busy spinner, sets `aria-busy="true"`, and disables it.   |
| `disabled` | `boolean`                              | `false`     | Disables the button. `loading` also forces the disabled state (so `loading` wins even if `disabled={false}`). |
| `type`     | `'button' \| 'submit' \| 'reset'`      | `'button'`  | Defaults to `button` to avoid accidental form submission.         |
| `children` | `ReactNode`                            | —           | The visible label and accessible name.                            |
| `...rest`  | native button attributes               | —           | Spread onto the `<button>`.                                       |

## Variants

| Variant     | Resting             | Hover / active                  | Use for                       |
| ----------- | ------------------- | ------------------------------- | ----------------------------- |
| `primary`   | `bg-brand-600`      | `bg-brand-700`                  | The single main action.       |
| `secondary` | `bg-neutral-100`    | `bg-neutral-300`                | Supporting actions.           |
| `ghost`     | transparent         | `bg-brand-50` / `bg-brand-100`  | Low-emphasis / inline actions.|

## Sizes

| Size | Height | Padding | Text   |
| ---- | ------ | ------- | ------ |
| `sm` | `h-8`  | `px-3`  | `sm`   |
| `md` | `h-10` | `px-4`  | `base` |

## States

- **Default / hover / active** — each variant defines distinct hover and active
  backgrounds so the control never reads as inert.
- **Focus** — a visible focus ring (`focus-visible:ring-2 ring-brand-500` with a
  `ring-offset`) is always present and never removed.
- **Disabled** — native `disabled`; `cursor-not-allowed`, reduced opacity, and
  hover is neutralized so it cannot look interactive.
- **Loading** — sets `aria-busy="true"`, disables interaction (so it is also
  `:disabled`), and shows an `aria-hidden` spinner while keeping the label.

## Accessibility

- Native `<button>` element — keyboard activation (Enter / Space) and the
  `button` role come for free.
- Accessible name is always the `children`; it is never removed in any state.
- Visible, non-removed focus ring meets focus-visibility expectations.
- States are distinguished by more than color (opacity + cursor for disabled,
  spinner + `aria-busy` for loading).
- `type="button"` by default prevents accidental form submission.
- Verified with `jest-axe`: zero violations across primary / secondary / ghost
  and the disabled / loading states.

## Tokens used

Styling is tokens-only (see [`../../target/ui/src/tokens.ts`](../../target/ui/src/tokens.ts) /
[`../DESIGN_TOKENS.md`](../DESIGN_TOKENS.md)):

- **Colors** — `brand` 50 / 100 / 500 / 600 / 700, `neutral` 50 / 100 / 300 / 900.
- **Radius** — `rounded-md` (token `radius.md`).

## Usage

```tsx
import { Button } from './components/Button/Button'

<Button onClick={save}>Save</Button>
<Button variant="secondary" size="sm">Cancel</Button>
<Button variant="ghost">Learn more</Button>
<Button loading>Saving…</Button>
<Button disabled>Unavailable</Button>
```
