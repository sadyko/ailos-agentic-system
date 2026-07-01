# shadcn-native Library Conversion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `target/ui` to a shadcn-native component library (theme driven by the *project*, not shadcn defaults) and add a first batch of ~15 core components, each with a smoke test + gallery entry, plus a written theming rule and a repeatable batching process.

**Architecture:** Add the `@/*` alias + `shadcn init` (Tailwind v4 / React 19 / Vite) so shadcn components install into `src/components/ui/`. The shadcn CSS-variable theme is re-skinned with the library's brand tokens (`--primary` = brand blue), keeping the existing `brand`/`neutral` `@theme` tokens so the 3 existing custom components keep working. Each shadcn component gets a `src/stories/<Name>.stories.tsx` (gallery) and a co-located smoke test (renders + zero axe). Dark mode is not enabled by default.

**Tech Stack:** React 19, Vite, TS, Tailwind v4, shadcn/ui CLI, Radix UI, class-variance-authority, tw-animate-css, lucide-react, Vitest + @testing-library/react + jest-axe (jsdom).

---

## Conventions
- All work in **`C:\Users\user\Desktop\ailos-agentic system`** (branch `build/shadcn-native`). Run from there; subagents `cd` in. Bash tool.
- Library gate: `npm --prefix target/ui run verify` (`tsc --noEmit && vitest run`). Gallery: `npm --prefix target/ui run gallery`. Root: `node --test`.
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- shadcn CLI is `npx shadcn@latest`. If a command prompts, pass non-interactive flags (`-y`, `-d`, `-b neutral`, `--overwrite` as noted). Setup tasks are **verification-driven**: done when `verify` is green.

## File Structure
```
target/ui/
  components.json                     # shadcn config (Task 1)
  tsconfig.app.json                   # + baseUrl/paths @/* (Task 1)
  vite.config.ts                      # + resolve.alias @ -> ./src (Task 1)
  vitest.setup.ts                     # + Radix jsdom shims (Task 1)
  src/index.css                       # shadcn var theme + re-appended brand tokens + --primary override (Task 1)
  src/lib/utils.ts                    # cn (shadcn); src/lib/cn.ts re-exports it (Task 1)
  src/components/ui/*.tsx             # shadcn components (Tasks 1 & 4)
  src/components/ui/*.test.tsx        # per-component smoke tests (Tasks 1 & 4)
  src/stories/*.stories.tsx          # gallery stories for shadcn components (Tasks 2 & 4)
  scripts/build-gallery.tsx           # + discover src/stories/*.stories.tsx (Task 2)
40_DESIGN/THEMING.md                  # the project-theme rule + batching process (Task 3)
CLAUDE.md                             # + reference to THEMING.md (Task 3)
```

---

### Task 1: shadcn-native setup (aliases, cn, init, theme reconcile, Radix shims) + prove with Button

**Files:** `tsconfig.app.json`, `vite.config.ts`, `src/lib/utils.ts`, `src/lib/cn.ts`, `components.json` (via CLI), `src/index.css`, `vitest.setup.ts`, `src/components/ui/button.tsx` (via CLI), `src/components/ui/button.test.tsx`.

- [ ] **Step 1: Add the `@/*` alias to `target/ui/tsconfig.app.json`** — inside `compilerOptions`, add:
```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```

- [ ] **Step 2: Add the alias to `target/ui/vite.config.ts`** — replace the file with:
```ts
/// <reference types="vitest" />
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
    css: false,
  },
})
```
(vitest reads this config, so `@/` resolves in tests too.)

- [ ] **Step 3: Create `target/ui/src/lib/utils.ts` (shadcn's cn location)**
```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```
Then make the existing `target/ui/src/lib/cn.ts` re-export it (so existing imports keep working):
```ts
export { cn } from './utils'
```

- [ ] **Step 4: Run `shadcn init`** (non-interactive; Tailwind v4 / Vite):
```bash
cd "C:/Users/user/Desktop/ailos-agentic system" && npx --prefix target/ui shadcn@latest init -b neutral -y 2>&1 | tail -20
```
If `--prefix` is not honored by npx, instead run it with the working directory set to the project: `cd "C:/Users/user/Desktop/ailos-agentic system/target/ui" && npx shadcn@latest init -b neutral -y`. Expected: creates `components.json`, rewrites `src/index.css` with the shadcn variable theme (`:root`/`.dark`/`@theme inline`), installs `tw-animate-css` + `class-variance-authority`. If it prompts for anything, accept defaults. Confirm `target/ui/components.json` exists.

- [ ] **Step 5: Reconcile `target/ui/src/index.css`** — after the shadcn-generated content, APPEND these two blocks so (a) the existing components' `brand`/`neutral` utilities still exist and (b) the palette is brand-driven, not shadcn's default. Add at the END of the file:
```css
/* --- Project brand tokens: preserved so existing components keep rendering --- */
@theme {
  --color-brand-50: #eef4ff;
  --color-brand-100: #d9e6ff;
  --color-brand-500: #3b6cff;
  --color-brand-600: #2b54e6;
  --color-brand-700: #1f3fb4;
  --color-neutral-50: #f7f7f8;
  --color-neutral-100: #ededf0;
  --color-neutral-300: #d3d4da;
  --color-neutral-500: #8a8c98;
  --color-neutral-700: #3f4150;
  --color-neutral-900: #1b1c22;
  --color-danger-500: #e5484d;
  --color-danger-600: #cc3b40;
}

/* --- Palette comes from the PROJECT, not shadcn: map the brand into shadcn's vars.
       (Per-product, override these values; never ship shadcn's default gray.) --- */
:root {
  --primary: #2b54e6;
  --primary-foreground: #ffffff;
  --ring: #2b54e6;
}
```
Do NOT add `class="dark"` anywhere — dark mode stays off by default.

- [ ] **Step 6: Add Radix jsdom shims to `target/ui/vitest.setup.ts`** — append (keep existing content):
```ts
import { beforeAll as _beforeAllRadix } from 'vitest'

// Radix UI relies on browser APIs jsdom lacks; shim them so components render in tests.
_beforeAllRadix(() => {
  if (!('ResizeObserver' in globalThis)) {
    // @ts-expect-error assign mock
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
  const proto = window.Element.prototype as unknown as Record<string, unknown>
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {}
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {}
  if (!proto.scrollIntoView) proto.scrollIntoView = () => {}
})
```

- [ ] **Step 7: Add the shadcn Button** and confirm the toolchain resolves shadcn imports:
```bash
cd "C:/Users/user/Desktop/ailos-agentic system/target/ui" && npx shadcn@latest add button -y --overwrite 2>&1 | tail -10
```
Expected: creates `src/components/ui/button.tsx` (imports `@/lib/utils`), installs `@radix-ui/react-slot`.

- [ ] **Step 8: Write the Button smoke test** `target/ui/src/components/ui/button.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Button } from '@/components/ui/button'

describe('ui/Button (smoke)', () => {
  it('mounts and has no axe violations', async () => {
    const { container } = render(<Button>Save</Button>)
    expect(container.querySelector('button')).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

- [ ] **Step 9: Verify** — the make-or-break check:
```bash
cd "C:/Users/user/Desktop/ailos-agentic system" && npm --prefix target/ui run verify 2>&1 | tail -6
```
Expected: `tsc --noEmit` clean (alias resolves, shadcn button typechecks), vitest green — the existing 17 tests PLUS the new ui/Button smoke test. If tsc errors on `@/` imports, the alias in tsconfig/vite is wrong — fix and re-run. If the existing components fail (missing `brand-*`), the index.css `@theme` re-append (Step 5) is missing/incorrect — fix. Done only when green.

- [ ] **Step 10: Commit**
```bash
cd "C:/Users/user/Desktop/ailos-agentic system" && git add -A && git commit -m "feat(ui): shadcn-native setup (alias, cn@lib/utils, init, brand-mapped theme, Radix jsdom shims) + Button"
```

---

### Task 2: Gallery discovery for shadcn components (`src/stories/`)

shadcn components are flat in `src/components/ui/`, but the gallery only scans `src/components/<Dir>/<Dir>.stories.tsx`. Add a second discovery path: `src/stories/*.stories.tsx`, each exporting `name` + `stories`.

**Files:** `target/ui/scripts/build-gallery.tsx`, `target/ui/src/stories/Button.stories.tsx`.

- [ ] **Step 1: Extend `build-gallery.tsx`** — after the existing per-component-dir discovery loop, ALSO scan `src/stories/`. Read the file, then add a discovery block that, for each `src/stories/<X>.stories.tsx`, imports it and uses its exported `name` (fallback: filename without `.stories`) as the component name and its exported `stories` array — pushing the same `{ component, stories }` shape the generator already renders. Concretely, add after the existing loop that builds the `all` array:
```ts
const STORIES_DIR = join(ROOT, 'src', 'stories')
if (existsSync(STORIES_DIR)) {
  for (const entry of readdirSync(STORIES_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.stories.tsx')) continue
    const mod = await import(pathToFileURL(join(STORIES_DIR, entry.name)).href)
    if (Array.isArray(mod.stories)) {
      const component = typeof mod.name === 'string' ? mod.name : entry.name.replace('.stories.tsx', '')
      all.push({ component, stories: mod.stories })
    }
  }
}
```
(Use the same `all` array / `import`/`readdirSync`/`join`/`pathToFileURL` already imported in the file. If names collide with a components-dir story, the flat one is fine to append.)

- [ ] **Step 2: Create `target/ui/src/stories/Button.stories.tsx`** (shadcn button demo)
```tsx
import { Button } from '@/components/ui/button'

export const name = 'ShadcnButton'
export const stories = [
  { name: 'Default', element: <Button>Button</Button> },
  { name: 'Secondary', element: <Button variant="secondary">Secondary</Button> },
  { name: 'Destructive', element: <Button variant="destructive">Delete</Button> },
  { name: 'Outline', element: <Button variant="outline">Outline</Button> },
]
```
(Named `ShadcnButton` so its gallery page doesn't collide with the existing custom `Button.html`.)

- [ ] **Step 3: Regenerate + verify**
```bash
cd "C:/Users/user/Desktop/ailos-agentic system" && npm --prefix target/ui run gallery 2>&1 | tail -2 && ls 40_DESIGN/gallery/
```
Expected: a `ShadcnButton.html` is written; it contains a rendered `<button>` with the brand color (`--primary`/`bg-primary`). `npm --prefix target/ui run verify` still green.
Confirm brand-driven: `grep -o "var(--primary)" 40_DESIGN/gallery/ShadcnButton.html | head -1` (the compiled CSS resolves `--primary` to `#2b54e6`).

- [ ] **Step 4: Commit**
```bash
cd "C:/Users/user/Desktop/ailos-agentic system" && git add -A && git commit -m "feat(ui): gallery discovers flat src/stories/ for shadcn components + Shadcn Button story"
```

---

### Task 3: The theming instruction (`THEMING.md` + `CLAUDE.md` + memory note)

**Files:** `40_DESIGN/THEMING.md`, `CLAUDE.md`.

- [ ] **Step 1: Create `40_DESIGN/THEMING.md`**
```markdown
# Theming rule — the palette comes from the PROJECT, never from shadcn

shadcn/ui is our **source of component code only**. The look — palette, radius, typography, light/dark — is **always derived from the specific project** (its name, function, audience, domain) and mapped into shadcn's CSS variables (`--primary`, `--background`, `--foreground`, `--card`, `--border`, `--radius`, …). Never ship shadcn's default gray/slate look.

## How to theme a project
1. Derive tokens from the product's identity/domain (ask the owner for brand colors / references if unknown).
2. Set them on `:root` (and only add a `.dark` block if the product wants dark mode — it's opt-in).
3. `--primary` drives the accent; keep `--primary-foreground` legible on it (check WCAG AA).

## Domain guardrails (examples)
- **Medical / health:** calm, clean, trustworthy — soft clinical blues/greens/teals, generous whitespace, high legibility. **No** harsh pure-black/pure-white or moody dark themes.
- **Finance:** deep, restrained blues/greens; precision over flourish.
- Match the palette to the product. When unsure, ask before building.

## Adding more shadcn components (the batching process)
For each new component: `npx shadcn@latest add <name>` → add `src/stories/<Name>.stories.tsx` (a default example, `name` + `stories`) → add `src/components/ui/<name>.test.tsx` (smoke: renders + zero axe) → `npm run verify` + `npm run gallery` → commit. Run ~15 at a time. Community registries (Aceternity, Magic UI, 21st.dev) are added the same way and re-themed via the project variables above.
```

- [ ] **Step 2: Add a line to `CLAUDE.md`** — under "Starting a NEW product", append:
```markdown
- **Theme comes from the project, not shadcn.** See `40_DESIGN/THEMING.md`: derive the palette from the product's domain (e.g. medical → calm clinical, no harsh dark/black-white), map it into shadcn's CSS variables, dark mode opt-in only.
```

- [ ] **Step 3: Commit**
```bash
cd "C:/Users/user/Desktop/ailos-agentic system" && git add -A && git commit -m "docs: THEMING.md (project-driven palette rule + domain guardrails + batching process) + CLAUDE.md ref"
```
(A matching memory `theme-from-project.md` will be saved by the controller after this task.)

---

### Task 4: Add the remaining 14 core components (batch)

For EACH component below, do the four mechanical steps. Components: **card, input, label, textarea, select, checkbox, switch, badge, tabs, dialog, tooltip, separator, avatar, alert**.

Per component `<name>`:
1. `cd "C:/Users/user/Desktop/ailos-agentic system/target/ui" && npx shadcn@latest add <name> -y --overwrite`
2. Create `src/components/ui/<name>.test.tsx` from the **smoke template** (below), using the component's demo element.
3. Create `src/stories/<Name>.stories.tsx` from the **story template** (below).
4. After finishing the batch: `npm --prefix target/ui run verify` (all smoke tests green, zero axe) then `npm --prefix target/ui run gallery`.

**Smoke test template** (`<name>.test.tsx`) — replace `DEMO` with the component's demo element and imports:
```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
/* imports */

describe('ui/<Name> (smoke)', () => {
  it('mounts and has no axe violations', async () => {
    const { container } = render(DEMO)
    expect(container.firstChild).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

**Story template** (`src/stories/<Name>.stories.tsx`):
```tsx
/* imports */
export const name = '<Name>'
export const stories = [
  { name: 'Default', element: DEMO },
]
```

**Per-component DEMO element** (use for both the story and the smoke `DEMO`; add the matching imports from `@/components/ui/<name>`):
- **card:** `<Card className="w-72"><CardHeader><CardTitle>Title</CardTitle><CardDescription>Description</CardDescription></CardHeader><CardContent>Content</CardContent></Card>`
- **input:** wrap for an accessible name: `<div><label htmlFor="i1">Email</label><Input id="i1" placeholder="you@example.com" /></div>`
- **label:** `<div><Label htmlFor="l1">Name</Label><input id="l1" /></div>`
- **textarea:** `<div><label htmlFor="t1">Message</label><Textarea id="t1" placeholder="Type…" /></div>`
- **select:** `<Select><SelectTrigger aria-label="Fruit" className="w-48"><SelectValue placeholder="Pick one" /></SelectTrigger><SelectContent><SelectItem value="a">Apple</SelectItem><SelectItem value="b">Banana</SelectItem></SelectContent></Select>`
- **checkbox:** `<div className="flex items-center gap-2"><Checkbox id="c1" /><label htmlFor="c1">Accept</label></div>`
- **switch:** `<div className="flex items-center gap-2"><Switch id="s1" /><label htmlFor="s1">Wifi</label></div>`
- **badge:** `<div className="flex gap-2"><Badge>Default</Badge><Badge variant="secondary">Secondary</Badge><Badge variant="destructive">Destructive</Badge></div>`
- **tabs:** `<Tabs defaultValue="a" className="w-72"><TabsList><TabsTrigger value="a">Account</TabsTrigger><TabsTrigger value="b">Password</TabsTrigger></TabsList><TabsContent value="a">Account</TabsContent><TabsContent value="b">Password</TabsContent></Tabs>`
- **dialog:** `<Dialog><DialogTrigger asChild><button>Open</button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Title</DialogTitle><DialogDescription>Body</DialogDescription></DialogHeader></DialogContent></Dialog>` (SSR/gallery shows the trigger; jsdom smoke renders the trigger — do NOT open it in the smoke test)
- **tooltip:** `<TooltipProvider><Tooltip><TooltipTrigger asChild><button>Hover</button></TooltipTrigger><TooltipContent>Tip</TooltipContent></Tooltip></TooltipProvider>`
- **separator:** `<div className="w-48"><span>Above</span><Separator className="my-2" /><span>Below</span></div>`
- **avatar:** `<Avatar><AvatarImage src="" alt="" /><AvatarFallback>JL</AvatarFallback></Avatar>`
- **alert:** `<Alert className="w-80"><AlertTitle>Heads up</AlertTitle><AlertDescription>Something to note.</AlertDescription></Alert>`

Notes: for interactive components (select, dialog, tooltip), the smoke test only asserts the trigger mounts + zero axe on the closed/default state — do not simulate opening. If a component's story element can't SSR in the gallery (throws), simplify its story to its trigger/default static element; the smoke test is the real gate.

- [ ] **Step 1: Add all 14 components + their smoke tests + stories** per the templates above.
- [ ] **Step 2: Verify**
```bash
cd "C:/Users/user/Desktop/ailos-agentic system" && npm --prefix target/ui run verify 2>&1 | tail -6
```
Expected: tsc clean; vitest green — the existing 17 + the 15 new smoke tests (Button from Task 1 + these 14). Fix any component whose smoke test fails (often a missing jsdom shim → add it in Step 6 of Task 1's file, or an accessible-name fix in the DEMO).
- [ ] **Step 3: Gallery + confirm**
```bash
cd "C:/Users/user/Desktop/ailos-agentic system" && npm --prefix target/ui run gallery 2>&1 | tail -2 && ls 40_DESIGN/gallery/ | wc -l
```
Expected: a gallery page per new component (Card, Input, …, Alert) + the existing ones; all render with the brand palette.
- [ ] **Step 4: Commit**
```bash
cd "C:/Users/user/Desktop/ailos-agentic system" && git add -A && git commit -m "feat(ui): add 14 core shadcn components (card,input,label,textarea,select,checkbox,switch,badge,tabs,dialog,tooltip,separator,avatar,alert) + smoke tests + gallery"
```

---

### Task 5: Final review

- [ ] **Step 1: Full green check**
```bash
cd "C:/Users/user/Desktop/ailos-agentic system" && npm --prefix target/ui run verify && npm --prefix target/ui run gallery && node --test
```
Expected: verify green (32 tests: 17 existing + 15 smoke), gallery writes all pages, root `node --test` green.

- [ ] **Step 2: Confirm the theming principle held**
```bash
cd "C:/Users/user/Desktop/ailos-agentic system" && grep -o "\-\-primary:#2b54e6" 40_DESIGN/gallery/ShadcnButton.html >/dev/null && echo "brand-driven OK" ; grep -rc "class=\"dark\"" 40_DESIGN/gallery/*.html | grep -v ':0' || echo "no dark applied (good)"
```
Expected: the compiled CSS carries `--primary:#2b54e6` (brand, not shadcn gray); no page applies `dark`.

- [ ] **Step 3: Dispatch a final code-quality reviewer** over the branch diff — focus: alias/init correctness, the index.css reconciliation (brand tokens present, `--primary` is the brand, `.dark` not applied), each shadcn component has a passing smoke test (renders + zero axe) and a gallery story, no regression to the 3 existing components, and THEMING.md accurately states the project-driven-palette rule. Address findings, re-verify.

---

## Self-Review (plan author)

**Spec coverage:** §1 principle → Task 3 (THEMING.md/CLAUDE.md) + Task 1 Step 5 (brand-mapped `--primary`, no dark). §3 conversion → Task 1. §4 gallery/tests → Task 2 (gallery discovery) + per-component smoke tests (Tasks 1 & 4). §5 first batch → Tasks 1 (button) + 4 (14 more). §6 batching process → THEMING.md (Task 3). §7 success criteria → Task 5. Existing-component coexistence → Task 1 Step 5 (brand tokens preserved) + verified in Steps 9/Task 5.

**Placeholder scan:** Task 4 is a template + explicit per-component DEMO elements (the varying content is fully specified for all 14) — a legitimate repeatable process, not hand-waving; the smoke test is the objective per-component gate. Setup tasks (init/add) are commands whose success criterion is `verify` green.

**Type/name consistency:** `cn` from `@/lib/utils`; shadcn components imported via `@/components/ui/<name>`. Story files export `name` + `stories` (matching the Task-2 gallery discovery). The custom `Button.stories.tsx` (existing) and the new `ShadcnButton` story are named distinctly to avoid a gallery filename collision. Smoke tests live at `src/components/ui/<name>.test.tsx` (vitest auto-discovers). `verify` command identical throughout.
```
