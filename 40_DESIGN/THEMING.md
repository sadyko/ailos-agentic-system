# Theming rule — the palette comes from the PROJECT, never from shadcn

shadcn/ui is our **source of component code only**. The *look* — palette, radius, typography, light/dark — is **always derived from the specific project** (its name, function, audience, domain) and mapped into shadcn's CSS variables (`--primary`, `--background`, `--foreground`, `--card`, `--border`, `--ring`, `--radius`, …). **Never ship shadcn's default gray/slate/near-black look.**

## How the mechanism works
shadcn components read CSS variables (`bg-primary` → `--color-primary` → `var(--primary)`). The library's `src/index.css` sets shadcn's defaults, then **overrides `--primary` (and `--ring`) to the brand** at the end (later declaration wins). Re-theming a product = swapping those variable values. Nothing about the component code changes.

## How to theme a project
1. Derive tokens from the product's identity/domain (ask the owner for brand colors / references if unknown — don't guess a brand).
2. Set them on `:root` in the product's stylesheet (map into `--primary`, `--background`, `--foreground`, `--card`, `--border`, `--radius`).
3. Keep `--primary-foreground` legible on `--primary` (check WCAG AA, ≥ 4.5:1 for text).
4. **Typography is project-driven too** — pick a font that fits the domain, not a generic default.
5. **Dark mode is opt-in.** shadcn ships a `.dark` block; only enable it (add `class="dark"`) when the product actually wants dark mode.

## Domain guardrails (examples, not exhaustive)
- **Medical / health:** calm, clean, trustworthy — soft clinical blues / greens / teals, generous whitespace, high legibility. **No** harsh pure-black/pure-white or moody dark themes.
- **Finance:** deep, restrained blues/greens; precision over flourish.
- **Consumer / playful:** warmer, more saturated — but still disciplined.
- Match the palette to the product. When unsure, ask before building.

## Adding more components (the batching process)
For each new component:
1. `npx shadcn@latest add <name>` (from `target/ui/`) — lands in `src/components/ui/<name>.tsx`.
2. Add `src/stories/<Name>.stories.tsx` — a default example, exporting `name` + `stories` (the gallery discovers these).
3. Add `src/components/ui/<name>.test.tsx` — a smoke test (renders the default + zero jest-axe violations; interactive components only assert the trigger, don't open).
4. `npm --prefix target/ui run verify` (tsc + vitest) then `npm --prefix target/ui run gallery`, then commit.

Run ~15 at a time. Community registries (Aceternity, Magic UI, 21st.dev, blocks) are added the same way and **re-themed via the project variables above** — never inherit their palette.

## shadcn CLI notes (v4.x, this project: Vite + Tailwind v4)
- `init`: `npx shadcn@latest init -b radix -t vite -p nova -y -f --no-reinstall` (`-b` = component library radix|base, NOT base color; `-t vite` template; `-p` preset; `--no-reinstall` avoids a hang).
- Aliases live in the **root `tsconfig.json`** (`paths` only — **no `baseUrl`**, it's a TS 6 error) and `vite.config.ts` `resolve.alias`.
- Components import from the unified **`radix-ui`** package (e.g. `import { Slot } from "radix-ui"`).
- The gallery compiles from the real `src/index.css` (so shadcn utilities + the brand `--primary` resolve).
