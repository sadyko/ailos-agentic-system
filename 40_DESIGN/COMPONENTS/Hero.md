# Hero

A marketing hero: an eyebrow badge link, a single headline, supporting copy, two
calls-to-action, and a framed product visual sitting on a subtle radial brand
glow. Adapted from a shadcn-styled source onto the library's design tokens, with
a local SVG dashboard mock in place of the original external screenshots.

- Source: [`../../target/ui/src/components/Hero/Hero.tsx`](../../target/ui/src/components/Hero/Hero.tsx)
- Mock: [`../../target/ui/src/components/Hero/DashboardMock.tsx`](../../target/ui/src/components/Hero/DashboardMock.tsx)
- Stories: [`../../target/ui/src/components/Hero/Hero.stories.tsx`](../../target/ui/src/components/Hero/Hero.stories.tsx)
- Gallery: [`../gallery/Hero.html`](../gallery/Hero.html)

> **Note:** The gallery preview (`../gallery/Hero.html`) is rendered with Tailwind
> via CDN for offline viewing; the app itself is styled by the real Tailwind build
> in `target/ui`.

## Props

| Prop           | Type                          | Default                                      | Description                                                                                                       |
| -------------- | ----------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `badge`        | `string`                      | `'New'`                                       | Small pill label inside the eyebrow link above the headline.                                                      |
| `title`        | `string`                      | `'Build better digital products, faster'`     | The page headline. Rendered as the single `<h1>`.                                                                 |
| `subtitle`     | `string`                      | generic agency copy                           | Supporting copy under the headline.                                                                               |
| `primaryCta`   | `{ label: string; href: string }` | `{ label: 'Get started', href: '#get-started' }` | Primary (filled) call to action. Rendered with the library `Button` as a `<button>`; `label` is its accessible name. |
| `secondaryCta` | `{ label: string; href: string }` | `{ label: 'Book a call', href: '#contact' }`  | Secondary (outlined) call to action. Rendered with the library `Button` (`variant="secondary"`).                  |
| `image`        | `{ src: string; alt: string }` | _none_                                       | When provided, renders a real `<img src alt>` in place of the local `DashboardMock`.                              |
| `animate`      | `boolean`                     | `true`                                        | When `true`, plays a staggered Framer Motion fade-up on mount. When `false` — or under reduced motion — renders fully visible with no entrance animation. |

## Notes

- **Light only.** Styled entirely with design tokens (`brand` / `neutral`); no
  shadcn classes or `--theme(...)` gradients remain. The original shadcn `Button`
  is replaced by the library [`Button`](./Button.md) (`variant="outline"` →
  `secondary`, default → `primary`), so both CTAs are real `<button>`s.
- **Icons** are from `lucide-react` (`PhoneCall`, `ArrowRight`), each marked
  `aria-hidden`.
- **Local SVG mock.** The framed visual defaults to `DashboardMock` — a
  self-contained inline-SVG analytics dashboard (top bar, three stat tiles, a
  line chart and a bar chart) using token colors. No external images
  (`storage.efferd.com` is gone). Pass `image` to swap in a real screenshot.
- **Entrance animation** uses Framer Motion (`motion`), replacing the original
  `tailwindcss-animate` classes. The component computes a `shouldAnimate` boolean
  from `animate` and `window.matchMedia('(prefers-reduced-motion: reduce)')`;
  when it is `false`, motion props are dropped entirely so there is no
  `opacity: 0` initial state.

## Accessibility

- Exactly **one `<h1>`** (the `title`).
- Both CTAs are `<button>`s whose label text is their accessible name.
- The `DashboardMock` exposes a single labelled image
  (`role="img"` + `aria-label="Sample product dashboard"`, which contains
  "dashboard"); the inner decorative SVG is `aria-hidden`.
- The two decorative radial-glow wrappers are `aria-hidden="true"`.
- Verified with `jest-axe`: zero violations on the static (`animate={false}`)
  render.

## Usage

```tsx
import { Hero } from './components/Hero/Hero'

// Defaults: generic copy, local dashboard mock, animated reveal.
<Hero />

// Custom copy and CTAs, animation off (also auto-off under reduced motion):
<Hero
  badge="New"
  title="Ship your next release with confidence"
  subtitle="One connected toolkit for design, build, and delivery."
  primaryCta={{ label: 'Get started', href: '/signup' }}
  secondaryCta={{ label: 'Book a call', href: '/contact' }}
  animate={false}
/>

// Bring your own screenshot instead of the local mock:
<Hero image={{ src: '/screens/app.webp', alt: 'Product dashboard' }} />
```

See the rendered hero in [`../gallery/Hero.html`](../gallery/Hero.html).
