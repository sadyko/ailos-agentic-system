# Orchestrator — System State

> Read state from disk → build a bounded frame → run one atomic agent task → validate at a gate → if PASS write the artifact and advance, if FAIL rework. The model is the worker; the vault is the truth.

## Current pointers
- Phase: BUILD
- Stage: STAGE_01
- Step: (set at runtime)
- last_verified_commit: see `30_BUILD/last_verified_commit.md`

## Engine
- Build engine: `00_SYSTEM/engine/build-loop.mjs` (run via the Workflow tool)
- Seed goal: `00_SYSTEM/engine/seed/STAGE_01_GOAL.md`

## Roles
- `00_SYSTEM/ROLES/{PLANNER,REVIEWER,EXPLORER,IMPLEMENTER,CRITIC}.md`
- `00_SYSTEM/ROLES/CONTROLLERS/{TEST_COVERAGE,MARKER_GUARD}.md`

## How state survives context loss
Persisted state lives here (vault) and in git. Each agent run rebuilds a fresh, bounded frame from these files, then is discarded. Nothing is lost on compaction because nothing important lives only in a context window.
