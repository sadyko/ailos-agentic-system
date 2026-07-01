# CLAUDE.md — How to drive this system

This repo is an **agentic build machine**: it turns a request into verified, committed work one atomic step at a time. The markdown vault + git are the source of truth; subagents are the workers; a Workflow script is the engine.

> **Creed:** read state from disk → build a bounded frame → run one atomic agent task → validate at a gate → if PASS advance, if FAIL rework. The model is the worker; the vault is the truth.

## How to start in a new chat

Open Claude Code with this folder as the working directory, then either:
- type **`/agentic-build`**, or
- just say **"build me a `<thing>`"** (e.g. "build a pricing card", "add a tenant-resolution function").

The owner is **non-technical** — they approve and describe in plain English; you do the code/design work and explain results simply. Never require them to read or write code.

## The two build modes (profiles)

Run the engine via the Workflow tool on `00_SYSTEM/engine/build-loop.mjs`:
- **UI / components:** `{ "scriptPath": "00_SYSTEM/engine/build-loop.mjs", "args": { "profile": "ui" } }`
  Builds an accessible React+TS+Tailwind component into the library. Gate = `tsc` + `vitest` + `jest-axe` + the sn-ui-checklist + web-design-guidelines. Output: a card in `40_DESIGN/COMPONENTS/` + a viewable `40_DESIGN/gallery/<Name>.html`.
- **Code / logic:** `{ "scriptPath": "00_SYSTEM/engine/build-loop.mjs" }` (default `code` profile)
  Builds a verified code unit. Gate = the project's test suite.

To build something new, write its goal to the profile's seed (`00_SYSTEM/engine/seed/...`) and a frozen acceptance test (the contract), then run the profile. The machine commits ONLY when every gate is green; `30_BUILD/last_verified_commit.md` advances only on green.

## Starting a NEW product — do this first

**Set the brand tokens before building components.** The owner will provide colors, fonts, and design references. Apply them as the single source of truth so every component is on-brand:
1. `target/ui/src/tokens.ts` (the machine-readable tokens)
2. `40_DESIGN/DESIGN_TOKENS.md` (the human doc)
3. `target/ui/src/index.css` `@theme { ... }` (what the real build + app actually use)

Put screenshot/design references in `40_DESIGN/refs/` and point the component's seed goal at them. The owner verifies look-and-feel by opening the gallery HTML in a browser (the gate checks accessibility + structure + design-checklist, not pixel-match — that visual check is the human's).

**Theme comes from the project, not shadcn.** The library is shadcn-native (components from the shadcn CLI/registry), but the palette/typography/mode are always derived from the product's domain — see `40_DESIGN/THEMING.md`. Map the project's brand into shadcn's CSS variables (`--primary`, …); never ship shadcn's default gray. Medical → calm clinical, no harsh dark/black-white. Dark mode is opt-in. Never use emojis in UI — use real (lucide) icons.

## Non-negotiables

- One atomic step per run; steps are sequential; **no commit without all gates green** (a crashed controller counts as FAIL).
- Rework is bounded to 2 retries, then it logs to `30_BUILD/issues.md` and stops rather than shipping something broken.
- Use the superpowers workflow for new work: **brainstorming → writing-plans → subagent-driven-development**, with an adversarial review and a falsification check before merging.
- `git push` after merging if asked (remote `origin` = github.com/sadyko/ailos-agentic-system, private).

## Map

- `00_SYSTEM/` — engine, roles, gates, orchestrator state
- `30_BUILD/` — per-stage artifacts, `issues.md`, `last_verified_commit.md`
- `40_DESIGN/` — tokens, component cards, the HTML gallery
- `target/` — code built by the machine · `target/ui/` — the React component library
- `99_LOG/DECISIONS.md` — append-only audit trail
- `docs/superpowers/` — specs + plans
- Known limitations / next steps: `30_BUILD/issues.md`
