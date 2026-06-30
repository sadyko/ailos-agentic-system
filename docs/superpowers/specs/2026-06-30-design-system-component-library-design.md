# Design System + Component Library — Design Spec (Vertical Slice)

- **Date:** 2026-06-30
- **Status:** Approved for implementation planning
- **Builds on:** the agentic build machine (`docs/superpowers/specs/2026-06-30-agentic-build-system-design.md`). This slice adds a **design/UI dimension** and a **reusable component library** to that machine.
- **Scope of this spec:** Extend the machine to build accessible, design-reviewed React components into a component library, prove it on one component (`Button`), and auto-generate a browsable HTML gallery. Multi-stage front-end, security controller, and screenshot/visual-regression gates are deferred.

---

## 1. Problem & intent

The user is non-technical and needs to ship **secure, well-designed, not-"AI-slop"** software. The existing machine builds *code* with hard gates. This slice adds the missing **design dimension**: a Designer role that generates production-grade UI, design gates that enforce accessibility + design-system discipline, a **reusable component library** (the source of UI truth for future products), and a **generated HTML gallery** so the user can visually review every component in a browser without running anything.

## 2. Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| First slice | **Design dimension + component library** | Directly serves "ship well-designed UI"; reuses the proven machine. |
| Design gate | **Code-only** (no real browser) | User's choice. Still hard: `tsc`, `eslint-plugin-jsx-a11y`, and `jest-axe` run real accessibility checks against a jsdom render — no browser download. Visual taste is enforced by the generator + checklist. |
| Stack | **React + TypeScript + Tailwind** (+ Radix primitives for accessible behavior) | Industry standard; what real products (and likely easymed) use; what `frontend-design` generates; components are drop-in reusable. |
| Architecture | **Approach A — extend the engine with a build profile** | The engine is already generic; add an inline `PROFILES` registry (`code` = existing, `ui` = new) selected by `args.profile`. No fork, no duplication. |
| First component | **`Button`** | Canonical first design-system primitive; rich state (default/hover/focus/disabled/loading) + accessibility surface so the gates have teeth. |
| Visual review | **Generated HTML gallery** (`40_DESIGN/gallery/`) | A self-contained `.html` mirror per component (all states, Tailwind inlined), regenerated deterministically on every add. The user double-clicks to review; no server. |

## 3. Architecture

### 3.1 Engine → profile-driven (one small generalization)

`00_SYSTEM/engine/build-loop.mjs` gains an inline `PROFILES` object. `ARGS.profile` (parsed from the string-args, default `code`) selects the active profile. A profile is a pure data record:

```
PROFILES = {
  code: { seed, stageDir, targetDir: 'target', testCmd: 'python -m unittest discover -s target -p "test_*.py"',
          implementerRole: 'IMPLEMENTER.md', controllers: ['TEST_COVERAGE.md','MARKER_GUARD.md'] },
  ui:   { seed, stageDir, targetDir: 'target/ui', testCmd: 'npm --prefix target/ui run verify',
          implementerRole: 'DESIGNER.md', controllers: ['UI_BUILD.md','UI_CHECKLIST.md','ACCESSIBILITY.md'],
          postStep: 'npm --prefix target/ui run gallery' }   // regenerate the HTML gallery
}
```

The existing `code` profile is byte-for-byte behavior-compatible (the `parse_duration` run still passes). All gate logic (Critic + controllers all-green before commit, 2-retry bound, falsify mode, honest `ok`) is unchanged — only the *which roles / which paths / which test command* is parameterized. A new optional `postStep` runs a deterministic command after a green gate and before commit (used to regenerate the gallery).

### 3.2 The UI target project — `target/ui/` (scaffolded once)

Vite + React + TS + Tailwind, plus the hard-gate toolchain. A single `npm run verify` script chains the hard gates so one command is the gate:

```
"verify": "tsc --noEmit && eslint . && vitest run"
```

- `tsc --noEmit` — typechecks (component + props correct).
- `eslint .` with `eslint-plugin-jsx-a11y` — lint + static accessibility lint.
- `vitest run` (jsdom) + `@testing-library/react` + `jest-axe` — renders the component, asserts states and accessible names, and asserts **zero axe violations**.

`npm run gallery` runs the gallery build (§3.5). One-time `npm install` is part of the scaffold task.

### 3.3 Design tokens — `40_DESIGN/DESIGN_TOKENS.md` (+ mirrored in `target/ui/tailwind.config`)

A small, disciplined system, authored once: a neutral scale, one brand/accent hue, semantic colors (success/warning/danger/info), a **type scale capped at 4 sizes**, a spacing scale, and a radius scale. The Tailwind config is the machine-readable mirror; the markdown is the human-readable source of truth. Tokens exist *before* the first component so the system is consistent and the sn-ui-checklist can pass ("systematic palette / limited type sizes / consistent spacing/radius").

### 3.4 New roles (in the vault)

- **`00_SYSTEM/ROLES/DESIGNER.md`** — the UI Implementer. Generates the component applying `frontend-design` principles + the design tokens (no off-token values). Writes: the component (`target/ui/src/components/<Name>/<Name>.tsx`), its `stories` (the list of states to render), its **library card** (`40_DESIGN/COMPONENTS/<Name>.md`), and `STEP_NN_OUTPUT.md`. Must satisfy the frozen acceptance spec without editing it. No leftover markers.
- **`00_SYSTEM/ROLES/CONTROLLERS/UI_BUILD.md`** (hard gate) — runs `npm --prefix target/ui run verify`. PASS only if tsc + eslint + vitest(+axe) are all green. Quotes the summary as evidence.
- **`00_SYSTEM/ROLES/CONTROLLERS/UI_CHECKLIST.md`** (LLM-judge) — contains the **sn-ui-checklist** criteria (Typography, Layout, Color, Style, Elements, Tactics) applied to the component code + tokens. PASS/FAIL with concrete, evidence-based findings.
- **`00_SYSTEM/ROLES/CONTROLLERS/ACCESSIBILITY.md`** (LLM-judge) — applies `web-design-guidelines` (semantics, focus order, ARIA, contrast intent, keyboard) on top of the automated axe gate.
- The **Critic** (existing) still does reality-based validation: runs `verify`, confirms each acceptance criterion is genuinely met.

`sn-ui-checklist` is also installed to `.claude/skills/` for manual human reviews, but the controller is self-contained (the criteria live in its role file) so it never depends on the Skill tool at runtime.

### 3.5 The component library + the generated gallery

- **Library (source of truth):** the React components in `target/ui/src/components/`, each with a markdown **card** at `40_DESIGN/COMPONENTS/<Name>.md` (purpose, anatomy, props, states, a11y notes, usage snippet, links to code + gallery file) and an `INDEX.md` listing all. Browsable in Obsidian.
- **Gallery (generated visual mirror):** `40_DESIGN/gallery/` holds `index.html` (links every component) + one self-contained **`<Name>.html`** per component. The `gallery` build script SSR-renders each component's `stories` (all states/variants) with `ReactDOMServer.renderToStaticMarkup`, inlines the compiled Tailwind CSS, and writes the standalone files. It is **deterministic** (no LLM) and runs as the profile's `postStep`, so the gallery is always in sync and committed with the component. The user opens `40_DESIGN/gallery/index.html` (or any `<Name>.html`) by double-click to review — no server, works offline.

This honors "mirror the existing ones as html, not a separate library": the React components are the single library; the gallery is a generated reflection of them.

### 3.6 Frozen acceptance (the gate's teeth, code-only)

We author `target/ui/src/components/Button/Button.acceptance.test.tsx` (vitest + Testing Library + jest-axe) asserting Button's contract: it renders; each `variant` (primary/secondary/ghost) and `size` (sm/md) renders; `disabled` disables interaction; `loading` shows a busy state and blocks clicks; it exposes an **accessible name**; and it has **zero axe violations**. The machine (Designer) writes `Button.tsx` to satisfy this; the Critic + UI_BUILD run it for real.

## 4. The dummy task (first component)

> **`Button`** — props `variant: 'primary'|'secondary'|'ghost'`, `size: 'sm'|'md'`, `disabled`, `loading`, standard button attributes. Tokens only (no arbitrary colors/spacing). Visible focus ring, `aria-busy` when loading, native `<button>` semantics.

Acceptance criteria live in the frozen test + the library card; the gates run them for real.

## 5. Success criteria ("proven")

1. `npm --prefix target/ui run verify` passes on a clean checkout (toolchain real and green).
2. The machine, run with the `ui` profile, builds `Button.tsx` satisfying the frozen acceptance test, passes UI_BUILD + UI_CHECKLIST + ACCESSIBILITY + Critic, and commits — `last_verified_commit` advances, `DECISIONS.md` logs it.
3. `40_DESIGN/COMPONENTS/Button.md` exists; `40_DESIGN/gallery/Button.html` + updated `index.html` exist and render the Button's states when opened in a browser.
4. **Falsification:** feed an inaccessible Button (a `<div onClick>` with no role/label, or a token-violating color) and confirm the a11y/checklist gate FAILs and **no commit** is made (HEAD unchanged).
5. The original `code` profile still builds `parse_duration` green (no regression).

## 6. Deferred (YAGNI for this slice)

Screenshot / visual-regression gate (Playwright); the multi-stage front-end (project overview → many STAGEs); the SECURITY controller + hardened commit hook; dark mode / theming; additional components beyond `Button`; publishing the library as an npm package.

## 7. Extensibility

Adding a component later = run the `ui` profile with a new seed naming the component + a frozen acceptance test; the gallery and index update automatically. Adding a new gate = drop a controller `.md` into the `ui` profile's `controllers` list. Pointing at a real product = a new profile targeting that repo. Re-introduce human gates for production/medical surfaces (spec §10 of the base system).

---

## One-line creed (unchanged)

> Read state from disk → build a bounded frame → run one atomic agent task → validate at a gate → if PASS write the artifact and advance, if FAIL rework. The model is the worker; the vault is the truth.
