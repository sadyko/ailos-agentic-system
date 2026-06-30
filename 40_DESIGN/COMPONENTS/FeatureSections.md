# FeatureSections

A marketing "features" grid: a centered header (badge + Playfair-italic title)
over a responsive six-card grid, where each card pairs a decorative mini mock-UI
illustration with a short title and description.

- Source: [`../../target/ui/src/components/FeatureSections/FeatureSections.tsx`](../../target/ui/src/components/FeatureSections/FeatureSections.tsx)
- Stories: [`../../target/ui/src/components/FeatureSections/FeatureSections.stories.tsx`](../../target/ui/src/components/FeatureSections/FeatureSections.stories.tsx)
- Gallery: [`../gallery/FeatureSections.html`](../gallery/FeatureSections.html)

> **Note:** The gallery preview (`../gallery/FeatureSections.html`) is rendered with Tailwind via CDN for offline viewing; the app itself is styled by the real Tailwind build in `target/ui`.

## Props

| Prop       | Type        | Default                              | Description                                                                                                |
| ---------- | ----------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `badge`    | `string`    | `'Feature-rich suite'`               | Pill label shown above the title.                                                                          |
| `title`    | `string`    | `'Everything you need\nin one suite'`| Two-line section heading (rendered as the `<h2>`). Use `\n` for the line break; it renders with `whitespace-pre-line`. |
| `features` | `Feature[]` | the six default cards                | Override the default feature cards. Each `Feature` is `{ id, title, description, content }`, where `content` is the decorative `ReactNode` mock. |
| `animate`  | `boolean`   | `true`                               | When `true`, plays a staggered Framer Motion `whileInView` reveal. When `false` — or when the user prefers reduced motion — renders fully visible with no entrance animation. |

## Notes

- **Light only.** Styled with design tokens (`brand` / `neutral`), no `mode` prop.
  Functional colors (LinkedIn-blue `#0077b5`, verified-green `#22c55e` on
  `#dcfce7`, credit-yellow `#fbbf24`) are kept as semantic accents.
- **Entrance animation** uses Framer Motion (`motion`). The component computes a
  `shouldAnimate` boolean from `animate` and
  `window.matchMedia('(prefers-reduced-motion: reduce)')`; when it is `false`,
  motion props are dropped entirely so there is no `opacity: 0` initial state.
- **Title font.** The title is set in *Playfair Display* italic via the single
  allowed inline style (`fontFamily`). Consumers must load that font, e.g.
  `import '@fontsource/playfair-display/400-italic.css'` (it is a dependency of
  the library) or via a `<link>` to Google Fonts.

## Accessibility

- Each card's decorative mock illustration is wrapped `aria-hidden="true"`, so
  the bespoke SVGs, mock buttons, and placeholder data are not announced; only
  the real card title (`<h3>`) and description text reach assistive technology.
- Decorative icons/SVGs also carry `aria-hidden="true"` individually.
- Real text (badge, title, card titles/descriptions) is kept at AA contrast on
  the `neutral-50` / white surfaces.
- Verified with `jest-axe`: zero violations on the static (`animate={false}`)
  render.

## Usage

```tsx
import { FeatureSections } from './components/FeatureSections/FeatureSections'
import '@fontsource/playfair-display/400-italic.css'

// Defaults: six cards, animated reveal.
<FeatureSections />

// De-branded copy of your own, animation off (also auto-off under reduced motion):
<FeatureSections
  badge="Why teams choose us"
  title={'Everything you need\nto move faster'}
  animate={false}
/>
```

See the rendered cards in [`../gallery/FeatureSections.html`](../gallery/FeatureSections.html).
