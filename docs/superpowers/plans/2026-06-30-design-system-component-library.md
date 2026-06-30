# Design System + Component Library (Vertical Slice) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a design/UI dimension to the agentic build machine and prove it by having the machine autonomously build one accessible, design-reviewed React `Button` into a component library, with an auto-generated browsable HTML gallery.

**Architecture:** Extend the existing Workflow engine with an inline **profile registry** (`code` = the proven Python pipeline, unchanged; `ui` = a new React pipeline). The `ui` profile swaps in a Designer role and design controllers, targets `target/ui/` (Vite + React + TS), gates on `tsc --noEmit && vitest run` (with **jest-axe** for real accessibility checks in jsdom), and runs a deterministic post-step that SSR-renders each component to a self-contained HTML file in `40_DESIGN/gallery/`.

**Tech Stack:** Claude Code Workflow tool · React 18 + TypeScript + Vite · Vitest (jsdom) + @testing-library/react + jest-axe (hard gates) · Tailwind via CDN (gallery only) · `tsx` (SSR gallery script) · the `frontend-design` / `web-design-guidelines` skills + the embedded sn-ui-checklist (design review).

---

## Conventions

- All paths are relative to the repo root `c:\Users\user\Desktop\ailos-agentic system` (a git repo, on `master`). Run commands from the repo root.
- Use the **Bash** tool (Git Bash / POSIX). For Node test discovery use `node --test` (no path) or an explicit file — never `node --test tests/` (broken on this Windows/Node 24 setup).
- Commit messages end with the repo's `Co-Authored-By` trailer (omitted below for brevity — add it).
- Tasks 7–9 invoke the **Workflow tool** and MUST run in the main session (the user opted into autonomous Workflow). Do not delegate them to a subagent.

## File Structure (created/modified by this plan)

```
00_SYSTEM/engine/build-loop.mjs            # MODIFIED: add PROFILES registry (code + ui)   (Task 4)
00_SYSTEM/engine/seed/UI_BUTTON_GOAL.md    # NEW: ui STAGE goal                              (Task 6)
00_SYSTEM/ROLES/CRITIC.md                  # MODIFIED: command-agnostic                      (Task 5)
00_SYSTEM/ROLES/DESIGNER.md                # NEW: the UI implementer role                    (Task 5)
00_SYSTEM/ROLES/CONTROLLERS/UI_BUILD.md        # NEW: hard gate (tsc+vitest+axe)            (Task 5)
00_SYSTEM/ROLES/CONTROLLERS/UI_CHECKLIST.md    # NEW: sn-ui-checklist review                (Task 5)
00_SYSTEM/ROLES/CONTROLLERS/ACCESSIBILITY.md   # NEW: web-design-guidelines review          (Task 5)
40_DESIGN/DESIGN_TOKENS.md                 # NEW: human-readable token doc                  (Task 2)
40_DESIGN/COMPONENTS/                       # component cards (written by the machine)       (Task 7)
40_DESIGN/gallery/                          # generated HTML mirror (index.html + *.html)    (Task 7)
target/ui/                                  # NEW: React+TS+Vite project + gate toolchain    (Task 1)
target/ui/src/tokens.ts                     # NEW: design tokens (single source)             (Task 2)
target/ui/scripts/build-gallery.tsx         # NEW: SSR gallery generator                     (Task 3)
target/ui/src/components/Button/Button.acceptance.test.tsx  # NEW: frozen acceptance (red)   (Task 6)
tests/validate_engine.test.mjs              # MODIFIED: assert PROFILES                       (Task 4)
tests/validate_roles.test.mjs               # MODIFIED: assert new role files                 (Task 5)
.claude/skills/sn-ui-checklist/SKILL.md     # NEW: install checklist for manual reviews      (Task 5)
README.md                                   # MODIFIED: document ui profile + gallery         (Task 10)
```

---

### Task 1: Scaffold `target/ui` (React + TS + Vite) + the hard-gate toolchain

**Goal of this task:** a real React+TS project where `npm --prefix target/ui run verify` (`tsc --noEmit && vitest run`) passes on a sanity test that renders an element and runs jest-axe. This proves the gate toolchain works *before* any component exists.

**Files:**
- Create: `target/ui/` (via `npm create vite`), then add `vitest.setup.ts`, modify `vite.config.ts`, `package.json`, add `src/sanity.test.tsx`.

- [ ] **Step 1: Scaffold the base project (non-interactive)**

Run:
```bash
npm create vite@latest target/ui -- --template react-ts
npm --prefix target/ui install
```
Expected: `target/ui/` created with `package.json`, `tsconfig*.json`, `vite.config.ts`, `src/`. `node_modules` installed.

- [ ] **Step 2: Add the gate toolchain dev-dependencies**

Run:
```bash
npm --prefix target/ui install -D vitest jsdom @testing-library/react @testing-library/jest-dom jest-axe tsx
```
Expected: installs succeed; these versions are written into `target/ui/package.json`.

- [ ] **Step 3: Add the Vitest setup file**

Create `target/ui/vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
import { expect } from 'vitest'
import { toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)
```

- [ ] **Step 4: Wire Vitest into `vite.config.ts`**

Replace `target/ui/vite.config.ts` with:
```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
    css: false,
  },
})
```

- [ ] **Step 5: Add the `verify`, `gallery`, and `test` scripts**

Edit `target/ui/package.json` so the `"scripts"` block contains (keep Vite's existing `dev`/`build`/`preview`):
```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "verify": "tsc --noEmit && vitest run",
  "gallery": "tsx ./scripts/build-gallery.tsx"
}
```

- [ ] **Step 6: Add a sanity test (proves render + axe work with no component yet)**

Create `target/ui/src/sanity.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'

describe('toolchain sanity', () => {
  it('renders and queries by role', () => {
    render(<button type="button">Hello</button>)
    expect(screen.getByRole('button', { name: 'Hello' })).toBeInTheDocument()
  })

  it('runs jest-axe with no violations on valid markup', async () => {
    const { container } = render(<button type="button">Hello</button>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

- [ ] **Step 7: Run verify**

Run: `npm --prefix target/ui run verify`
Expected: `tsc --noEmit` produces no output (success), then Vitest reports the 2 sanity tests passing.
If a dependency/config needs a version adjustment to reach green, that adjustment IS part of this task — the task is done only when `verify` is green.

- [ ] **Step 8: Commit**

```bash
git add target/ui package.json
git commit -m "feat(ui): scaffold target/ui React+TS+Vite with vitest+jest-axe gate toolchain"
```
(Note: `node_modules/` is already gitignored.)

---

### Task 2: Design tokens (single source + human doc)

**Files:**
- Create: `target/ui/src/tokens.ts`, `40_DESIGN/DESIGN_TOKENS.md`
- Test: `tests/validate_design_tokens.test.mjs`

- [ ] **Step 1: Write the failing validator**

Create `tests/validate_design_tokens.test.mjs`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('DESIGN_TOKENS.md documents the token system', () => {
  const t = readFileSync('40_DESIGN/DESIGN_TOKENS.md', 'utf8')
  for (const k of ['brand', 'neutral', 'type scale', 'spacing', 'radius']) {
    assert.match(t, new RegExp(k, 'i'), `missing token group: ${k}`)
  }
})

test('tokens.ts exports a tokens object with brand + radius', () => {
  const t = readFileSync('target/ui/src/tokens.ts', 'utf8')
  assert.match(t, /export const tokens/, 'tokens.ts must export `tokens`')
  assert.match(t, /brand/, 'tokens must include brand palette')
  assert.match(t, /radius/, 'tokens must include radius')
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node --test tests/validate_design_tokens.test.mjs`
Expected: FAIL (files not found).

- [ ] **Step 3: Write `target/ui/src/tokens.ts`**

```ts
// Single source of design truth. The gallery injects these into the Tailwind CDN config
// so components render with the right brand colors; DESIGN_TOKENS.md mirrors this for humans.
export const tokens = {
  colors: {
    brand: {
      50: '#eef4ff', 100: '#d9e6ff', 500: '#3b6cff', 600: '#2b54e6', 700: '#1f3fb4',
    },
    neutral: {
      50: '#f7f7f8', 100: '#ededf0', 300: '#d3d4da', 500: '#8a8c98',
      700: '#3f4150', 900: '#1b1c22',
    },
    danger: { 500: '#e5484d', 600: '#cc3b40' },
  },
  radius: { sm: '0.375rem', md: '0.5rem', lg: '0.75rem' },
} as const
```

- [ ] **Step 4: Write `40_DESIGN/DESIGN_TOKENS.md`**

```markdown
# Design Tokens

The single, disciplined system every component must use. No off-token colors, sizes, or spacing.
Machine-readable mirror: `target/ui/src/tokens.ts` (injected into the gallery's Tailwind config).

## Color
- **brand** (primary actions / focus): brand-500 `#3b6cff`, brand-600 `#2b54e6` (hover), brand-700 (active).
- **neutral** (text, borders, surfaces): neutral-50 → neutral-900. Use ≤4 neutrals per screen.
- **danger** (destructive): danger-500 / danger-600.
- Keep structural colors (neutral) distinct from interactive colors (brand). One CTA hierarchy.

## Type scale (cap at 4 sizes)
- body `16px`, small `14px`, heading `20px`, display `28px`. Use weight/case/color before adding a size.

## Spacing
- Use the Tailwind scale only: 1, 2, 3, 4, 6, 8 (= 0.25rem … 2rem). No arbitrary gaps.

## Radius
- sm `0.375rem`, md `0.5rem` (default), lg `0.75rem`. Be consistent per component.
```

- [ ] **Step 5: Run the validator**

Run: `node --test tests/validate_design_tokens.test.mjs`
Expected: 2 tests pass.

- [ ] **Step 6: Confirm tokens.ts typechecks**

Run: `npm --prefix target/ui run verify`
Expected: still green (tokens.ts compiles; sanity tests pass).

- [ ] **Step 7: Commit**

```bash
git add target/ui/src/tokens.ts 40_DESIGN/DESIGN_TOKENS.md tests/validate_design_tokens.test.mjs
git commit -m "feat(ui): design tokens (single source) + human-readable doc"
```

---

### Task 3: The gallery generator (SSR → self-contained HTML)

The gallery auto-discovers any `*.stories.tsx` under `src/components/`, SSR-renders each story, and writes a standalone HTML file per component (Tailwind via CDN with tokens injected, so it renders offline-in-browser without a build). Validated end-to-end in Task 7 (it needs a real component); here we just write it and confirm it runs without a story (empty gallery).

**Files:**
- Create: `target/ui/scripts/build-gallery.tsx`

- [ ] **Step 1: Write the gallery generator**

Create `target/ui/scripts/build-gallery.tsx`:
```tsx
import { readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import { tokens } from '../src/tokens'

type Story = { name: string; element: ReactElement }

// ESM (package.json "type":"module"): derive __dirname from import.meta.url
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')                    // target/ui
const COMPONENTS_DIR = join(ROOT, 'src', 'components')
const OUT_DIR = resolve(ROOT, '..', '..', '40_DESIGN', 'gallery')   // repo-root/40_DESIGN/gallery

const tailwindConfig = JSON.stringify({
  theme: { extend: { colors: { brand: tokens.colors.brand, neutral: tokens.colors.neutral, danger: tokens.colors.danger }, borderRadius: tokens.radius } },
})

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<script src="https://cdn.tailwindcss.com"></script>
<script>tailwind.config = ${tailwindConfig}</script>
</head><body class="bg-neutral-50 text-neutral-900 p-8">${body}</body></html>`
}

async function loadStories(dir: string): Promise<{ component: string; stories: Story[] }[]> {
  if (!existsSync(COMPONENTS_DIR)) return []
  const out: { component: string; stories: Story[] }[] = []
  for (const entry of readdirSync(COMPONENTS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const storyFile = join(COMPONENTS_DIR, entry.name, `${entry.name}.stories.tsx`)
    if (!existsSync(storyFile)) continue
    const mod = await import(pathToFileURL(storyFile).href)
    if (Array.isArray(mod.stories)) out.push({ component: entry.name, stories: mod.stories })
  }
  return out
}

const all = await loadStories(COMPONENTS_DIR)
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

for (const { component, stories } of all) {
  const body = stories.map((s) =>
    `<section class="mb-8"><h2 class="text-sm font-medium text-neutral-500 mb-3">${s.name}</h2>` +
    `<div class="flex flex-wrap items-center gap-4">${renderToStaticMarkup(s.element)}</div></section>`,
  ).join('\n')
  writeFileSync(join(OUT_DIR, `${component}.html`), page(component, body), 'utf8')
}

const links = all.map((c) => `<li class="mb-2"><a class="text-brand-600 underline" href="./${c.component}.html">${c.component}</a></li>`).join('\n')
writeFileSync(join(OUT_DIR, 'index.html'),
  page('Component Gallery', `<h1 class="text-2xl font-semibold mb-6">Component Gallery</h1><ul>${links || '<li>No components yet.</li>'}</ul>`),
  'utf8')

console.log(`gallery: wrote ${all.length} component page(s) to ${OUT_DIR}`)
```

- [ ] **Step 2: Run it (empty gallery is valid)**

Run: `npm --prefix target/ui run gallery`
Expected: prints `gallery: wrote 0 component page(s) ...` and creates `40_DESIGN/gallery/index.html` containing "No components yet."

- [ ] **Step 3: Verify the index file exists**

Run: `cat 40_DESIGN/gallery/index.html | head -3`
Expected: HTML doctype + the Tailwind CDN script tag.

- [ ] **Step 4: Commit**

```bash
git add target/ui/scripts/build-gallery.tsx 40_DESIGN/gallery/index.html
git commit -m "feat(ui): SSR gallery generator (auto-discovers *.stories.tsx -> standalone HTML)"
```

---

### Task 4: Generalize the engine with a profile registry

Replace `00_SYSTEM/engine/build-loop.mjs` with the profile-driven version below. The `code` profile is behavior-identical to today; the `ui` profile is added. `args.profile` selects (default `code`). Vault state paths that must NOT collide are per-profile (`stageDir`); `last_verified_commit`/`DECISIONS`/`issues` stay shared.

**Files:**
- Modify: `00_SYSTEM/engine/build-loop.mjs` (full replacement)
- Modify: `tests/validate_engine.test.mjs`

- [ ] **Step 1: Extend the engine validator**

Replace `tests/validate_engine.test.mjs` with:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

test('engine compiles as an async-wrapped Workflow body (syntax only)', () => {
  let src = readFileSync('00_SYSTEM/engine/build-loop.mjs', 'utf8')
  src = src.replace(/export\s+const\s+meta/, 'const meta')
  assert.doesNotThrow(
    () => new AsyncFunction('agent', 'parallel', 'pipeline', 'phase', 'log', 'args', 'budget', 'workflow', src),
    'engine has a syntax error',
  )
})

test('engine enforces gate safety + profile invariants', () => {
  const src = readFileSync('00_SYSTEM/engine/build-loop.mjs', 'utf8')
  assert.match(src, /MAX_RETRIES\s*=\s*2/, 'retry bound must be 2')
  assert.match(src, /gate\.green/, 'must compute a green gate')
  assert.match(src, /git commit/, 'must commit on green')
  assert.match(src, /mode === 'falsify'/, 'must support falsify mode')
  assert.match(src, /typeof args === 'string'/, 'must normalize string args')
  assert.match(src, /const PROFILES\s*=/, 'must define a PROFILES registry')
  assert.match(src, /PROFILES\[\s*ARGS\.profile\s*\]\s*\|\|\s*PROFILES\.code/, 'must select profile with code default')
  assert.match(src, /ui:\s*\{/, 'must define a ui profile')
  assert.match(src, /export const meta/, 'must export a meta block')
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node --test tests/validate_engine.test.mjs`
Expected: the profile assertions FAIL (current engine has no PROFILES).

- [ ] **Step 3: Replace `00_SYSTEM/engine/build-loop.mjs` with the profile-driven engine**

```js
export const meta = {
  name: 'build-loop',
  description: 'Agentic build engine (profile-driven): Planner -> Reviewer -> [Explorer -> Implementer -> Critic + controllers] -> gated commit. The vault is the truth; the model is the worker.',
  phases: [
    { title: 'Plan' },
    { title: 'Build' },
    { title: 'Gate' },
    { title: 'Record' },
  ],
}

// ---------- shared vault paths (profile-independent) ----------
const ROLES = '00_SYSTEM/ROLES'
const ISSUES = '30_BUILD/issues.md'
const LVC = '30_BUILD/last_verified_commit.md'
const DECISIONS = '99_LOG/DECISIONS.md'
const MAX_RETRIES = 2

// ---------- args (may arrive as a parsed object OR a raw JSON string) ----------
const ARGS = (function () {
  if (!args) return {}
  if (typeof args === 'string') { try { return JSON.parse(args) } catch (e) { return {} } }
  return args
})()
const falsify = ARGS.mode === 'falsify'

// ---------- build profiles ----------
const PROFILES = {
  code: {
    seed: '00_SYSTEM/engine/seed/STAGE_01_GOAL.md',
    acceptance: 'target/test_duration_acceptance.py',
    testCmd: 'python -m unittest discover -s target -p "test_*.py"',
    targetDir: 'target/',
    stageDir: '30_BUILD/STAGES/STAGE_01',
    implementerRole: 'IMPLEMENTER.md',
    controllers: ['CONTROLLERS/TEST_COVERAGE.md', 'CONTROLLERS/MARKER_GUARD.md'],
    postStepCmd: null,
    falsifyFiles: ['target/duration.py'],
  },
  ui: {
    seed: '00_SYSTEM/engine/seed/UI_BUTTON_GOAL.md',
    acceptance: 'target/ui/src/components/Button/Button.acceptance.test.tsx',
    testCmd: 'npm --prefix target/ui run verify',
    targetDir: 'target/ui/',
    stageDir: '30_BUILD/STAGES/UI_STAGE_01',
    implementerRole: 'DESIGNER.md',
    controllers: ['CONTROLLERS/UI_BUILD.md', 'CONTROLLERS/UI_CHECKLIST.md', 'CONTROLLERS/ACCESSIBILITY.md'],
    postStepCmd: 'npm --prefix target/ui run gallery',
    falsifyFiles: ['target/ui/src/components/Button/Button.tsx'],
  },
}
const profile = PROFILES[ARGS.profile] || PROFILES.code
const STAGE_DIR = profile.stageDir
const STEPS_DIR = STAGE_DIR + '/STEPS'

// ---------- structured-output schemas ----------
const PLAN_SCHEMA = { type: 'object', required: ['steps'], properties: { steps: { type: 'array', items: {
  type: 'object', required: ['id', 'title', 'files', 'acceptance_criteria'], properties: {
    id: { type: 'string' }, title: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    acceptance_criteria: { type: 'array', items: { type: 'string' } } } } } } }
const VERDICT_SCHEMA = { type: 'object', required: ['verdict'], properties: {
  verdict: { enum: ['PASS', 'REWORK'] }, reasons: { type: 'array', items: { type: 'string' } } } }
const EXPLORE_SCHEMA = { type: 'object', required: ['context'], properties: { context: { type: 'string' } } }
const IMPL_SCHEMA = { type: 'object', required: ['summary'], properties: {
  files_changed: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } } }
const CHECK_SCHEMA = { type: 'object', required: ['verdict'], properties: {
  verdict: { enum: ['PASS', 'FAIL'] }, evidence: { type: 'string' },
  failing_criteria: { type: 'array', items: { type: 'string' } } } }
const CTRL_SCHEMA = { type: 'object', required: ['name', 'verdict'], properties: {
  name: { type: 'string' }, verdict: { enum: ['PASS', 'FAIL'] }, evidence: { type: 'string' } } }
const COMMIT_SCHEMA = { type: 'object', required: ['committed'], properties: {
  committed: { type: 'boolean' }, commit_hash: { type: 'string' } } }

// ---------- frame builder: bounded prompt from a role file + exact paths ----------
function frame(roleFile, reads, writePath, task, extra) {
  return [
    'You are one role in an agentic build system. FIRST Read your role definition and obey it exactly:',
    '  ROLE FILE: ' + roleFile,
    reads && reads.length
      ? 'Read ONLY these input artifacts (nothing else in the vault):\n' + reads.map(function (r) { return '  - ' + r }).join('\n')
      : 'No input artifacts to read.',
    writePath ? 'Write your output artifact to EXACTLY this path: ' + writePath : 'You write no artifact file.',
    'TASK: ' + task,
    extra || '',
    'Return your structured result exactly as your role specifies.',
  ].filter(Boolean).join('\n\n')
}

// ===================== PHASE: PLAN (Planner -> Reviewer, bounded rework) =====================
let steps
if (falsify) {
  steps = [{ id: 'STEP_01', title: '(falsification: planted broken file)',
    files: profile.falsifyFiles, acceptance_criteria: ['the frozen acceptance suite must pass'] }]
} else {
  phase('Plan')
  let plan, review, ptries = 0
  do {
    plan = await agent(
      frame(ROLES + '/PLANNER.md', [profile.seed, profile.acceptance], STAGE_DIR + '/STAGE_PLAN.md',
        'Read the STAGE goal and the frozen acceptance tests. Decompose the goal into atomic STEPs with explicit, testable acceptance criteria mapped to the tests. Write STAGE_PLAN.md and return the steps.'),
      { label: 'planner', phase: 'Plan', schema: PLAN_SCHEMA })
    if (!plan) return { ok: false, where: 'plan', reason: 'planner produced nothing' }
    review = await agent(
      frame(ROLES + '/REVIEWER.md', [STAGE_DIR + '/STAGE_PLAN.md'], STAGE_DIR + '/STAGE_REVIEW.md',
        'Judge whether the plan is well-posed (atomic steps, testable criteria mapped to the frozen tests, explicit files, full coverage of the goal). Write STAGE_REVIEW.md and return the verdict.'),
      { label: 'reviewer', phase: 'Plan', schema: VERDICT_SCHEMA })
    ptries++
  } while (review && review.verdict === 'REWORK' && ptries <= MAX_RETRIES)
  if (!review || review.verdict !== 'PASS') {
    return { ok: false, where: 'plan', reason: 'plan did not pass review', review }
  }
  steps = plan.steps
}

// ===================== PER-STEP: Explorer -> Implementer -> Gate (sequential) =====================
const results = []
for (let i = 0; i < steps.length; i++) {
  const step = steps[i]
  const nn = String(i + 1).padStart(2, '0')
  const outPath = STEPS_DIR + '/STEP_' + nn + '_OUTPUT.md'
  const checkPath = STEPS_DIR + '/STEP_' + nn + '_CHECK.md'

  // ---- Explorer (read-only) ----
  let ctx = { context: '(falsify: explorer skipped)' }
  if (!falsify) {
    phase('Build')
    ctx = await agent(
      frame(ROLES + '/EXPLORER.md', [profile.targetDir], '',
        'Gather minimal read-only context for ' + step.id + ' (' + step.title + '). Files in scope: ' + step.files.join(', ') + '.'),
      { label: 'explorer:' + step.id, phase: 'Build', schema: EXPLORE_SCHEMA }) || ctx
  }

  // ---- Implementer/Designer -> Gate, bounded rework ----
  let gate, itries = 0
  do {
    if (!falsify) {
      phase('Build')
      const reworkNote = (itries > 0 && gate)
        ? '\nThis is REWORK attempt ' + itries + '. The gate FAILED with: ' + JSON.stringify(gate.fails) + '. Fix EXACTLY these and nothing else.'
        : ''
      const impl = await agent(
        frame(ROLES + '/' + profile.implementerRole, [profile.acceptance], outPath,
          'Implement ' + step.id + ': ' + step.title + '. Acceptance criteria:\n- ' + step.acceptance_criteria.join('\n- ') +
          '\nExplorer context:\n' + ctx.context +
          '\nMake the frozen acceptance tests pass; do NOT modify them. Write/modify ONLY: ' + step.files.join(', ') + ' (plus the component story + library card if your role requires them). Then write ' + outPath + '.' + reworkNote),
        { label: 'implementer:' + step.id, phase: 'Build', schema: IMPL_SCHEMA })
      if (!impl) return { ok: false, where: 'implement', step: step.id, reason: 'implementer produced nothing' }
    }

    // ---- Gate: Critic + the profile's controllers (parallel, read-only judging) ----
    phase('Gate')
    const tasks = [
      function () { return agent(
        frame(ROLES + '/CRITIC.md', [outPath, profile.acceptance], checkPath,
          'Validate ' + step.id + ' against its acceptance criteria. You MUST run the test command yourself: `' + profile.testCmd + '`. ' +
          (falsify ? 'The OUTPUT artifact may be absent; judge solely by running the tests. ' : '') +
          'Acceptance criteria:\n- ' + step.acceptance_criteria.join('\n- ') + '\nWrite ' + checkPath + ' and return the verdict.'),
        { label: 'critic:' + step.id, phase: 'Gate', schema: CHECK_SCHEMA }) },
    ]
    for (const ctrl of profile.controllers) {
      const ctrlFile = ctrl
      tasks.push(function () { return agent(
        frame(ROLES + '/' + ctrlFile, [], '',
          'Apply your controller role to ' + step.id + ' (' + step.title + '). Project test/verify command: `' + profile.testCmd + '`. Files in scope: ' + step.files.join(', ') + '. Read your role file and follow it exactly.'),
        { label: 'ctrl:' + ctrlFile.replace(/.*\//, '').replace('.md', '') + ':' + step.id, phase: 'Gate', schema: CTRL_SCHEMA }) })
    }
    const judged = await parallel(tasks)
    const critic = judged[0]
    const controllerResults = judged.slice(1)
    const fails = []
    if (!critic || critic.verdict !== 'PASS') fails.push({ critic: critic ? (critic.failing_criteria || critic.evidence) : 'critic missing' })
    for (const c of controllerResults) {
      if (!c) fails.push({ controller: 'a controller agent returned null (crash/invalid output) — treated as FAIL' })
      else if (c.verdict !== 'PASS') fails.push({ [c.name]: c.evidence })
    }
    gate = { green: fails.length === 0, fails: fails, critic: critic, controllers: controllerResults.filter(Boolean) }
    itries++
  } while (!falsify && !gate.green && itries <= MAX_RETRIES)

  // ---- Falsification mode: return the gate verdict, never commit ----
  if (falsify) {
    return { ok: !gate.green, mode: 'falsify', profile: ARGS.profile || 'code', committed: false, gate: gate,
      note: gate.green
        ? 'FALSIFICATION FAILED: gate passed a deliberately broken file'
        : 'OK: gate correctly FAILED the deliberately broken file' }
  }

  // ---- Gate exhausted without green: log the issue, do NOT commit ----
  if (!gate.green) {
    await agent(
      'Append a dated entry to ' + ISSUES + ' for the unresolved gate failure on ' + step.id + ': ' + JSON.stringify(gate.fails) +
      '. Read ' + ISSUES + ' first if it exists, append, then write it back. Return {"name":"recorder","verdict":"PASS","evidence":"logged"}.',
      { label: 'issue:' + step.id, phase: 'Record', schema: CTRL_SCHEMA })
    results.push({ step: step.id, committed: false, gate: gate })
    continue
  }

  // ---- GREEN: (optional post-step) + commit + record (a recorder agent does git/fs) ----
  phase('Record')
  const rec = await agent(
    'All gates passed for ' + step.id + '. Do EXACTLY, in order, using Bash:\n' +
    (profile.postStepCmd ? '0. Run `' + profile.postStepCmd + '` (regenerates the component gallery).\n' : '') +
    '1. `git add -A`\n' +
    '2. `git commit -m "build(' + step.id + '): ' + step.title + '"`\n' +
    '3. `git rev-parse HEAD` to capture the commit hash\n' +
    '4. Write that hash as the ONLY line of ' + LVC + '\n' +
    '5. Append one line to ' + DECISIONS + ' (read it first if present, then append, then write back): "<UTC date>  ' + (ARGS.profile || 'code') + '  ' + step.id + '  PASS  <hash>"\n' +
    '6. `git add ' + LVC + ' ' + DECISIONS + ' && git commit -m "chore(' + step.id + '): record verified commit"`\n' +
    'Return {"committed":true,"commit_hash":"<hash>"}.',
    { label: 'record:' + step.id, phase: 'Record', schema: COMMIT_SCHEMA })
  results.push({ step: step.id, committed: !!(rec && rec.committed), commit_hash: rec && rec.commit_hash, gate: gate })
}

const allCommitted = results.length > 0 && results.every(function (r) { return r.committed })
return { ok: allCommitted, mode: 'normal', profile: ARGS.profile || 'code', allCommitted: allCommitted, results: results }
```

- [ ] **Step 4: Run the engine validator + full node suite**

Run: `node --test`
Expected: all tests pass (engine validator now sees `PROFILES`, the code-default selector, and the `ui:` profile).

- [ ] **Step 5: Commit**

```bash
git add 00_SYSTEM/engine/build-loop.mjs tests/validate_engine.test.mjs
git commit -m "feat(engine): profile registry (code + ui); ui adds Designer + design controllers + gallery post-step"
```

---

### Task 5: Roles — make Critic command-agnostic + add the design roles + install the checklist

**Files:**
- Modify: `00_SYSTEM/ROLES/CRITIC.md`
- Create: `00_SYSTEM/ROLES/DESIGNER.md`, `CONTROLLERS/UI_BUILD.md`, `CONTROLLERS/UI_CHECKLIST.md`, `CONTROLLERS/ACCESSIBILITY.md`
- Create: `.claude/skills/sn-ui-checklist/SKILL.md` (copy of the user's checklist, for manual reviews)
- Modify: `tests/validate_roles.test.mjs`

- [ ] **Step 1: Extend the roles validator**

Replace the `REQUIRED` array in `tests/validate_roles.test.mjs` with (keep the rest of the file as-is):
```js
const REQUIRED = [
  ['00_SYSTEM/ROLES/PLANNER.md',                     [/atomic/i, /acceptance criteria/i, /"steps"/]],
  ['00_SYSTEM/ROLES/REVIEWER.md',                    [/well-posed/i, /PASS/, /REWORK/]],
  ['00_SYSTEM/ROLES/EXPLORER.md',                    [/read-only/i, /"context"/]],
  ['00_SYSTEM/ROLES/IMPLEMENTER.md',                 [/ONE atomic/i, /do NOT modify/i, /"files_changed"/]],
  ['00_SYSTEM/ROLES/CRITIC.md',                      [/run the test command/i, /"verdict"/]],
  ['00_SYSTEM/ROLES/CONTROLLERS/TEST_COVERAGE.md',   [/unittest/, /TEST_COVERAGE/]],
  ['00_SYSTEM/ROLES/CONTROLLERS/MARKER_GUARD.md',    [/git diff/i, /MARKER_GUARD/, /TODO/]],
  ['00_SYSTEM/ROLES/DESIGNER.md',                    [/frontend-design/i, /design tokens/i, /do NOT modify/i, /stories/i]],
  ['00_SYSTEM/ROLES/CONTROLLERS/UI_BUILD.md',        [/run verify/i, /jest-axe|axe/i, /UI_BUILD/]],
  ['00_SYSTEM/ROLES/CONTROLLERS/UI_CHECKLIST.md',    [/Typography/i, /Layout/i, /Color/i, /UI_CHECKLIST/]],
  ['00_SYSTEM/ROLES/CONTROLLERS/ACCESSIBILITY.md',   [/accessible name|aria|role/i, /ACCESSIBILITY/]],
]
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node --test tests/validate_roles.test.mjs`
Expected: the CRITIC line + the 4 new roles FAIL.

- [ ] **Step 3: Make `00_SYSTEM/ROLES/CRITIC.md` command-agnostic**

Replace its body with:
```markdown
# Role: CRITIC (reality-based gate)

You decide PASS / FAIL for a STEP by checking REALITY, not claims. Structural success never implies factual success — run the tests yourself.

Inputs: `STEP_NN_OUTPUT.md` and the frozen acceptance tests (exact paths given).
You MUST run the test command given in your task (the project's test/verify command) and read its real output.

PASS only if every test passes AND the output genuinely satisfies every acceptance criterion.
FAIL otherwise, listing `failing_criteria` with the test/output evidence.

Output: write `STEP_NN_CHECK.md` (verdict + evidence + per-criterion result) to the given path.

Return: `{ "verdict": "PASS" | "FAIL", "evidence": "<test output excerpt>", "failing_criteria": ["..."] }`
```

- [ ] **Step 4: Write `00_SYSTEM/ROLES/DESIGNER.md`**

```markdown
# Role: DESIGNER (UI implementer)

You build ONE accessible, production-grade React component per STEP, applying the `frontend-design` skill's principles (distinctive, not generic "AI slop") and the design tokens. You never edit the frozen tests.

Inputs: the STEP + acceptance criteria + Explorer context + the frozen acceptance test (read it as the contract) + `40_DESIGN/DESIGN_TOKENS.md` + `target/ui/src/tokens.ts`.

You write, for a component named `<Name>`:
- `target/ui/src/components/<Name>/<Name>.tsx` — the component. Native semantic elements; visible focus ring; correct ARIA; tokens only (no off-token colors/spacing/radius). No leftover markers (TODO/FIXME/placeholder/debug).
- `target/ui/src/components/<Name>/<Name>.stories.tsx` — `export const stories: { name: string; element: React.ReactElement }[]` covering every state/variant (the gallery renders these).
- `40_DESIGN/COMPONENTS/<Name>.md` — the library card: purpose, anatomy, props table, states, accessibility notes, a usage snippet, and links to the code + `../gallery/<Name>.html`.
- `STEP_NN_OUTPUT.md` — what you changed and how it satisfies each acceptance criterion.

Rules: make the frozen acceptance test pass without modifying it; if this is a REWORK attempt, fix EXACTLY the cited failures.

Return: `{ "files_changed": ["..."], "summary": "..." }`
```

- [ ] **Step 5: Write `00_SYSTEM/ROLES/CONTROLLERS/UI_BUILD.md`**

```markdown
# Controller: UI_BUILD (hard gate)

Run the project's verify command (given in your task): `npm --prefix target/ui run verify`.
This runs `tsc --noEmit` (types) then `vitest run` (render + state assertions + **jest-axe** accessibility checks in jsdom).

PASS only if the command exits 0 with zero type errors and zero failing tests (including zero axe violations). Quote the vitest summary line as evidence. On failure, quote the first failing assertion / type error.

Return: `{ "name": "UI_BUILD", "verdict": "PASS" | "FAIL", "evidence": "<summary or first failure>" }`
```

- [ ] **Step 6: Write `00_SYSTEM/ROLES/CONTROLLERS/UI_CHECKLIST.md`**

```markdown
# Controller: UI_CHECKLIST (design review — evidence-based)

Review the component code + `40_DESIGN/DESIGN_TOKENS.md` against this checklist. Base findings on visible evidence in the code; prefer concrete language ("uses 3 corner radii") over taste ("feels off"). PASS only if there are no high-severity issues.

- **Typography:** ≤4 font sizes; hierarchy matches content priority; weight/case/color used before adding a size.
- **Layout:** intentional spacing on the token scale; clear alignment; affordances obvious.
- **Color:** systematic palette (tokens only); structural vs interactive colors distinct; one clear CTA hierarchy; disciplined neutrals.
- **Style:** intentional, consistent corner radius; borders/shadows support hierarchy, not noise; considered interaction states (hover/focus/active/disabled).
- **Elements:** inputs/controls have default/hover/focus/disabled/error states as applicable; components feel complete, not happy-path only.
- **Tactics:** looks explored, not first-draft; not generic/derivative ("AI slop").

Return: `{ "name": "UI_CHECKLIST", "verdict": "PASS" | "FAIL", "evidence": "<top findings with code references, or 'clean'>" }`
```

- [ ] **Step 7: Write `00_SYSTEM/ROLES/CONTROLLERS/ACCESSIBILITY.md`**

```markdown
# Controller: ACCESSIBILITY (web-design-guidelines + axe)

Apply the `web-design-guidelines` principles to the component code, on top of the automated axe gate that already ran in UI_BUILD. Verify:
- Native semantic element used (e.g. `<button>` not `<div onClick>`); correct `role` only when needed.
- An accessible name is always present (text content or `aria-label`).
- Keyboard operability + a visible focus indicator (focus ring, not `outline:none` with no replacement).
- State is conveyed non-visually where needed (e.g. `aria-busy`, `disabled`, `aria-invalid`).
- Sufficient color-contrast intent for text and controls (tokens chosen with contrast in mind).

PASS only if all hold. FAIL with the specific violation + the line/snippet.

Return: `{ "name": "ACCESSIBILITY", "verdict": "PASS" | "FAIL", "evidence": "<violations or 'clean'>" }`
```

- [ ] **Step 8: Install the sn-ui-checklist skill (for manual human reviews)**

Run:
```bash
mkdir -p ".claude/skills/sn-ui-checklist"
cp "C:/Users/user/Desktop/SKILL.md" ".claude/skills/sn-ui-checklist/SKILL.md"
```
Expected: `.claude/skills/sn-ui-checklist/SKILL.md` exists.

- [ ] **Step 9: Run the roles validator + full suite**

Run: `node --test`
Expected: all tests pass (roles validator now sees the command-agnostic Critic + 4 new role files).

- [ ] **Step 10: Commit**

```bash
git add 00_SYSTEM/ROLES tests/validate_roles.test.mjs .claude/skills/sn-ui-checklist
git commit -m "feat(roles): command-agnostic Critic + Designer + UI_BUILD/UI_CHECKLIST/ACCESSIBILITY controllers; install sn-ui-checklist"
```

---

### Task 6: UI seed goal + frozen Button acceptance test (red baseline)

**Files:**
- Create: `00_SYSTEM/engine/seed/UI_BUTTON_GOAL.md`
- Create: `target/ui/src/components/Button/Button.acceptance.test.tsx`

- [ ] **Step 1: Write the seed goal**

`00_SYSTEM/engine/seed/UI_BUTTON_GOAL.md`:
```markdown
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
```

- [ ] **Step 2: Write the frozen acceptance test**

`target/ui/src/components/Button/Button.acceptance.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Button } from './Button'

describe('Button (frozen acceptance)', () => {
  it('renders a native button with its accessible name', () => {
    render(<Button>Save</Button>)
    const btn = screen.getByRole('button', { name: 'Save' })
    expect(btn).toBeInTheDocument()
    expect(btn.tagName).toBe('BUTTON')
  })

  it('renders all variant x size combinations', () => {
    const variants = ['primary', 'secondary', 'ghost'] as const
    const sizes = ['sm', 'md'] as const
    for (const variant of variants) for (const size of sizes) {
      render(<Button variant={variant} size={size}>X</Button>)
    }
    expect(screen.getAllByRole('button')).toHaveLength(6)
  })

  it('is disabled when disabled', () => {
    render(<Button disabled>Save</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('is busy and non-interactive when loading', () => {
    render(<Button loading>Save</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-busy', 'true')
    expect(btn).toBeDisabled()
  })

  it('has zero axe violations across variants and states', async () => {
    const { container } = render(
      <div>
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button disabled>Disabled</Button>
        <Button loading>Loading</Button>
      </div>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

- [ ] **Step 3: Confirm RED (Button.tsx absent)**

Run: `npm --prefix target/ui run verify`
Expected: FAIL — `tsc` errors that `./Button` has no exported `Button` (and/or Vitest cannot resolve the import). This is the failing contract the machine will satisfy.

- [ ] **Step 4: Commit the red baseline**

```bash
git add 00_SYSTEM/engine/seed/UI_BUTTON_GOAL.md target/ui/src/components/Button/Button.acceptance.test.tsx
git commit -m "feat(ui): Button seed goal + frozen acceptance suite (red)"
```

---

### Task 7: Integration run — the machine builds `Button` (MAIN SESSION)

> Runs in the main session via the Workflow tool with `args: { profile: "ui" }`. Do not delegate.

- [ ] **Step 1: Confirm all node validators are green**

Run: `node --test`
Expected: all pass. Do not proceed otherwise.

- [ ] **Step 2: Run the engine with the ui profile**

Invoke the `Workflow` tool with:
```
{ "scriptPath": "00_SYSTEM/engine/build-loop.mjs", "args": { "profile": "ui" } }
```
Expected return (shape): `{ "ok": true, "mode": "normal", "profile": "ui", "allCommitted": true, "results": [ { "step": "STEP_01", "committed": true, "gate": { "green": true, ... } } ] }`.

- [ ] **Step 3: Verify the component is real and the gate truly passed**

Run:
```bash
npm --prefix target/ui run verify 2>&1 | tail -5
ls target/ui/src/components/Button/
```
Expected: verify is GREEN (tsc clean; the 5 acceptance tests + sanity tests pass, zero axe violations). `Button.tsx`, `Button.stories.tsx`, `Button.acceptance.test.tsx` all present.

- [ ] **Step 4: Verify the library card + gallery were generated**

Run:
```bash
ls 40_DESIGN/COMPONENTS/ 40_DESIGN/gallery/
head -3 40_DESIGN/gallery/Button.html
```
Expected: `40_DESIGN/COMPONENTS/Button.md` exists; `40_DESIGN/gallery/Button.html` + updated `index.html` exist; `Button.html` is a full HTML doc with the Tailwind CDN script and rendered `<button>` markup.

- [ ] **Step 5: Verify the gated commit + audit trail**

Run:
```bash
git log --oneline -3
cat 30_BUILD/last_verified_commit.md
cat 99_LOG/DECISIONS.md
git status --porcelain && echo "(clean if empty)"
```
Expected: a `build(STEP_01): ...` + `chore(STEP_01): record ...` commit; `last_verified_commit.md` matches the build commit; `DECISIONS.md` has a `ui  STEP_01  PASS  <hash>` line; tree clean.

- [ ] **Step 6: (Human) Open the gallery to see it**

Tell the user: open `40_DESIGN/gallery/Button.html` (and `index.html`) in a browser to visually review the Button states. This is the human visual check.

---

### Task 8: Falsification — an inaccessible button must be blocked (MAIN SESSION)

> Proves the design gate can FAIL. Main session.

- [ ] **Step 1: Record the baseline HEAD**

Run: `git rev-parse HEAD > "$TMPDIR_BASE/ui_baseline.txt" 2>/dev/null || git rev-parse HEAD`
Then note the printed hash (call it BASELINE).

- [ ] **Step 2: Plant an inaccessible Button (no semantics, no accessible name)**

Run:
```bash
cat > target/ui/src/components/Button/Button.tsx <<'TSX'
// deliberately inaccessible: a div with a click handler, no role, no name
export function Button(props: any) {
  return <div onClick={props.onClick} className="bg-brand-600" />
}
TSX
npm --prefix target/ui run verify 2>&1 | tail -5
```
Expected: verify FAILS (the acceptance tests fail: not a `<button>`, no accessible name, axe violations).

- [ ] **Step 3: Run the engine in ui falsify mode (MAIN SESSION)**

Invoke the `Workflow` tool with:
```
{ "scriptPath": "00_SYSTEM/engine/build-loop.mjs", "args": { "profile": "ui", "mode": "falsify" } }
```
Expected return: `{ "ok": true, "mode": "falsify", "profile": "ui", "committed": false, "note": "OK: gate correctly FAILED the deliberately broken file", "gate": { "green": false, ... } }`.

- [ ] **Step 4: Verify NO commit slipped through**

Run:
```bash
test "$(git rev-parse HEAD)" = "<BASELINE>" && echo "PASS: HEAD unchanged — inaccessible button blocked" || echo "FAIL: a commit slipped through"
```
Expected: `PASS: HEAD unchanged`.

- [ ] **Step 5: Restore the green Button**

Run:
```bash
git checkout -- target/ui/src/components/Button/Button.tsx
git checkout -- .
git status --porcelain && echo "(clean if empty)"
npm --prefix target/ui run verify 2>&1 | tail -1
```
Expected: tree clean; verify green again (the real Button restored from the commit).

---

### Task 9: Regression — the `code` profile still works (MAIN SESSION)

> Cheap proof the engine refactor didn't break the original Python pipeline.

- [ ] **Step 1: Record baseline + plant broken duration.py**

Run:
```bash
git rev-parse HEAD
cat > target/duration.py <<'PY'
def parse_duration(s):
    return 0
PY
python -m unittest discover -s target -p "test_*.py" 2>&1 | tail -1
```
Expected: FAILS (broken impl). Note the HEAD hash (BASELINE2).

- [ ] **Step 2: Run the engine in code falsify mode (MAIN SESSION)**

Invoke the `Workflow` tool with:
```
{ "scriptPath": "00_SYSTEM/engine/build-loop.mjs", "args": { "profile": "code", "mode": "falsify" } }
```
Expected: `{ "ok": true, "mode": "falsify", "profile": "code", "committed": false, "note": "OK: gate correctly FAILED ..." }`.

- [ ] **Step 3: Verify no commit + restore**

Run:
```bash
test "$(git rev-parse HEAD)" = "<BASELINE2>" && echo "PASS: code profile gate still blocks" || echo "FAIL"
git checkout -- target/duration.py
python -m unittest discover -s target -p "test_*.py" 2>&1 | tail -1
git status --porcelain && echo "(clean if empty)"
```
Expected: `PASS`; tests OK after restore; tree clean.

---

### Task 10: Docs — document the `ui` profile + gallery

**Files:**
- Modify: `README.md`
- Modify: `.claude/skills/agentic-build/SKILL.md`

- [ ] **Step 1: Append a UI section to `README.md`**

Add to `README.md`:
```markdown

## UI / component library (the `ui` profile)
Build accessible React components into the library:
- Run the Workflow tool: `{ "scriptPath": "00_SYSTEM/engine/build-loop.mjs", "args": { "profile": "ui" } }`.
- Components: `target/ui/` (gate: `npm --prefix target/ui run verify` = tsc + vitest + jest-axe).
- Library cards: `40_DESIGN/COMPONENTS/`. Design tokens: `40_DESIGN/DESIGN_TOKENS.md`.
- **Visual gallery:** open `40_DESIGN/gallery/index.html` in a browser to see every component (regenerated on each build).
```

- [ ] **Step 2: Note the ui profile in the agentic-build skill**

Add to `.claude/skills/agentic-build/SKILL.md` under "Run it":
```markdown

### UI components
Pass `args: { "profile": "ui" }` to build a React component (Designer + design gates) instead of code. The HTML gallery at `40_DESIGN/gallery/` updates automatically.
```

- [ ] **Step 3: Confirm everything still green + commit**

Run: `node --test`
Expected: all pass.
```bash
git add README.md .claude/skills/agentic-build/SKILL.md
git commit -m "docs: document the ui build profile + component gallery"
```

---

## Self-Review (plan author)

**Spec coverage:** §2 decisions → Tasks 1–6; engine profile (§3.1) → Task 4; target/ui toolchain (§3.2) → Task 1; tokens (§3.3) → Task 2; roles (§3.4) → Task 5; library + gallery (§3.5) → Tasks 3 & 7; frozen acceptance (§3.6) → Task 6; Button (§4) → Tasks 6–7; success criteria (§5) → Tasks 7 (1–3), 8 (falsification), 9 (regression); deferred (§6) not built.

**Placeholder scan:** Concrete code/commands throughout. `<BASELINE>`/`<BASELINE2>` are runtime values the executor substitutes (a captured hash), not unfilled spec gaps — Tasks 8/9 capture them in step 1.

**Type consistency:** `tokens` shape (colors.brand/neutral/danger, radius) is used identically in `tokens.ts`, the gallery's injected config, and `DESIGN_TOKENS.md`. Button props (`variant`/`size`/`loading` + native attrs) match across the seed goal, the frozen test, and the DESIGNER role. The engine's profile fields (`seed/acceptance/testCmd/targetDir/stageDir/implementerRole/controllers/postStepCmd/falsifyFiles`) are all consumed in the engine body. `verify` = `tsc --noEmit && vitest run` is identical across Task 1, UI_BUILD.md, the ui profile `testCmd`, and the verification commands.

**Known risk (flagged, not a placeholder):** Task 1 is a real frontend toolchain install; exact dependency versions resolve at `npm install` time. The task's done-criterion is "`npm run verify` is green on the sanity test" — minor version/config adjustment to reach green is in-scope for that task.
```
