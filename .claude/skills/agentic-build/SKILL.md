---
name: agentic-build
description: Use to run the agentic build machine — drive a STAGE goal through Planner→Reviewer→Implementer→Critic→controllers→gated commit, with the Obsidian vault as state. Invoke when the user wants to build a coding task through the gated pipeline.
---

# Agentic Build

The machine turns a STAGE goal into verified, committed code one atomic STEP at a time. State lives in the vault (`00_SYSTEM`, `30_BUILD`, `99_LOG`) and git — never only in context.

## Run it
1. Read `00_SYSTEM/ORCHESTRATOR.md` for current phase/stage/step.
2. Ensure the STAGE goal exists at `00_SYSTEM/engine/seed/STAGE_01_GOAL.md` and a frozen acceptance suite exists under `target/`.
3. Invoke the Workflow tool: `{ "scriptPath": "00_SYSTEM/engine/build-loop.mjs" }`.
4. Review the returned summary, then the artifacts under `30_BUILD/STAGES/STAGE_01/`.

## Falsify (prove the gate works)
Plant a broken implementation, then run `{ "scriptPath": "00_SYSTEM/engine/build-loop.mjs", "args": { "mode": "falsify" } }`. Expect `committed: false` and HEAD unchanged.

## Invariants
- One atomic STEP per Implementer pass; STEPs run sequentially.
- No commit without the Critic AND every controller green (a controller that crashes counts as FAIL).
- `last_verified_commit` advances only on green; rework is bounded to 2 retries, then the failure is logged to `30_BUILD/issues.md`.

## Extending to a real codebase (e.g. easymed)
Point the role tasks at the real repo, swap `TEST_CMD` in `build-loop.mjs` to that repo's test command, add SECURITY/DB/MIGRATION controllers as new files under `00_SYSTEM/ROLES/CONTROLLERS/`, and reintroduce human gates for medical/production steps.
