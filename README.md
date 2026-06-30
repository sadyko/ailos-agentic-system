# Agentic Build System

A Claude Code-native machine that builds working code one verified atomic step at a time. The markdown vault + git are the source of truth; subagents are the workers; a Workflow script is the engine.

- Design spec: `docs/superpowers/specs/2026-06-30-agentic-build-system-design.md`
- Implementation plan: `docs/superpowers/plans/2026-06-30-agentic-build-system-slice.md`
- Engine: `00_SYSTEM/engine/build-loop.mjs`
- How to run: see the `agentic-build` skill (`.claude/skills/agentic-build/SKILL.md`).

## Test the machine's own scaffolding
`node --test`

## Run the build loop
Invoke the Workflow tool on `00_SYSTEM/engine/build-loop.mjs`. The loop:
Planner → Reviewer → (per STEP) Explorer → Implementer → Critic + controllers → gated commit.

The creed: **read state from disk → build a bounded frame → run one atomic agent task → validate at a gate → if PASS advance, if FAIL rework. The model is the worker; the vault is the truth.**

## UI / component library (the `ui` profile)
Build accessible React components into the library:
- Run the Workflow tool: `{ "scriptPath": "00_SYSTEM/engine/build-loop.mjs", "args": { "profile": "ui" } }`.
- Components: `target/ui/` (gate: `npm --prefix target/ui run verify` = tsc + vitest + jest-axe).
- Library cards: `40_DESIGN/COMPONENTS/`. Design tokens: `40_DESIGN/DESIGN_TOKENS.md`.
- **Visual gallery:** open `40_DESIGN/gallery/index.html` in a browser to see every component (regenerated on each build).
