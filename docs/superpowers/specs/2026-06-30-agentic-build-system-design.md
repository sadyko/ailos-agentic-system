# Agentic Build System — Design Spec (Vertical Slice)

- **Date:** 2026-06-30
- **Status:** Approved for implementation planning
- **Scope of this spec:** Build the reusable orchestration *machine* and prove its full build loop on one tiny, hard-gated dummy task. Pointing the machine at the real `easymed` codebase is a deliberate next sub-project, out of scope here.

---

## 1. Problem & intent

Turn a prompt into a project by building working code **one verified atomic step at a time**, with a markdown vault + git as the persistent source of truth so nothing is lost to context compaction. The master plan (`prompt → project`) describes the full system; this spec implements the smallest end-to-end vertical slice that proves the loop, per the plan's own directive: *"Don't build the whole swarm. Build a vertical slice on ONE real task first."*

## 2. The honest frame (non-negotiable invariants)

1. **The LLM is never the source of truth — the files on disk are.** Each agent reads a bounded slice, does one operation, writes the result back. Context loss is survivable because state lives in artifacts.
2. **Smaller tasks = fewer errors + less context.** One atomic STEP per Implementer run, always. STEPs run **sequentially** (no parallel writes into a shared codebase).
3. **Every step passes a gate before it counts.** A STEP is "done" only when the Critic and all controllers return PASS and `last_verified_commit` advances. No green, no progress.

## 3. Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| Orchestration backbone | **Claude Code-native** (no n8n) | Subagents = roles, Workflow engine = pipeline + rework loops, hooks = optional gates, vault + git = state. Collapses the plan's whole tech-stack table into tools already present. |
| First slice | **Machine + dummy task** | Decouples "does the machine work" from "is easymed hard." Lowest risk. |
| Loop control | **Fully autonomous Workflow**, review final result | Inner loop becomes deterministic JS; gates become script logic. Safe because the dummy task carries no medical/prod risk. Human-gate insertion points preserved for easymed. |
| Structure approach | **A: single Workflow engine + vault-as-state + thin skill front-door** | Least surface to debug; in-script gate is sufficient when the workflow is the sole committer. B's hardened hook and C's phase-split are grafted on when targeting easymed. |
| Dummy task validator | **Python stdlib `unittest`** (`python -m unittest`) | Zero dependencies (pytest absent in env); reproducible, factual test gate. |

## 4. Architecture

### 4.1 Vault structure (workspace root; markdown only — open in Obsidian anytime)

```
00_SYSTEM/
  ORCHESTRATOR.md          # phase/stage/step pointers + the one-line creed
  GATES.md                 # PASS / REWORK / PIVOT definitions
  ROLES/
    PLANNER.md  REVIEWER.md  EXPLORER.md  IMPLEMENTER.md  CRITIC.md
    CONTROLLERS/TEST_COVERAGE.md   CONTROLLERS/MARKER_GUARD.md
30_BUILD/
  STAGES/STAGE_01/STAGE_PLAN.md, STAGE_REVIEW.md, STEPS/STEP_01_*.md
  issues.md
  last_verified_commit.md
99_LOG/DECISIONS.md
target/                    # the actual codebase the machine modifies (the dummy lib)
```

Role `.md` files are the **single source of truth for prompts**. The workflow reads them at runtime and injects them into each agent. Editing a role on disk changes behavior with no code edit.

### 4.2 Roles = subagents (bounded frame in, one artifact out)

| Role | Reads | Writes | Gate it feeds |
|---|---|---|---|
| **Planner** | STAGE goal | `STAGE_PLAN.md` (goal → atomic STEPs + acceptance criteria) | — |
| **Reviewer** | `STAGE_PLAN.md` | `STAGE_REVIEW.md` (PASS/REWORK + reasons) | plan well-posed? |
| **Explorer** | `target/` (read-only) | context blob passed to Implementer | — |
| **Implementer** | one STEP + Explorer context | code in `target/` + `STEP_NN_OUTPUT.md` | — |
| **Critic** | OUTPUT + acceptance criteria; **runs the tests** | `STEP_NN_CHECK.md` (PASS/FAIL + evidence) | reality gate |
| **TEST_COVERAGE** controller | `target/` tests | PASS/FAIL via `python -m unittest` | controller |
| **MARKER_GUARD** controller | the diff | PASS/FAIL — no TODO/placeholder/leftover markers | controller |

### 4.3 Workflow engine (deterministic pipeline)

```
read ORCHESTRATOR.md → Planner → Reviewer
  └ REWORK? → back to Planner (max N tries)
decompose STAGE_PLAN into STEPs
FOR EACH STEP (sequential — never parallel on shared files):
   Explorer → Implementer → Critic
     └ FAIL? → back to Implementer (max N tries), log to issues.md
   controllers run → any FAIL → back to Implementer
   ALL PASS → git commit → write last_verified_commit.md → append DECISIONS.md
return final summary for human review
```

Invariants enforced in code: one atomic STEP per Implementer pass; sequential STEPs; **no commit without all-green**; `last_verified_commit` advances only on green; every rework loop has a max-tries bound that, when exhausted, halts and logs to `issues.md` rather than committing.

### 4.4 Memory discipline (persisted vs. ephemeral)

- **Persisted state:** vault + git. Current phase/STAGE/STEP, all artifacts, `last_verified_commit`. Survives restart, compaction, wiped context.
- **Per-run frame:** role prompt + the exact artifacts that role needs + the one task. Rebuilt fresh each agent call, discarded after. Because every frame is reconstructed from disk, "context loss" is not a failure mode.

## 5. The dummy task (real, hard-gated, zero-dependency)

A small pure module in `target/`, validated by `unittest`:

> **`parse_duration(s)`** — `"1h30m"` → `5400`, `"45s"` → `45`, `"2h"` → `7200`; raises `ValueError` on malformed input.

Acceptance criteria (the edge cases above + empty-string and bad-unit handling) live in `STAGE_PLAN.md`. The Critic and the TEST_COVERAGE controller both run the tests for real — proving a *factual* gate, not merely a structural one.

## 6. Gate definitions (`GATES.md`)

- **PASS** — all acceptance criteria met with on-disk evidence; tests green; controllers green. Advance and commit.
- **REWORK** — defects found; cite the artifact and the failing criterion; return to the producing role; increment try counter.
- **PIVOT** — the STEP/plan is mis-posed (criteria unsatisfiable or wrong); halt the loop, log to `issues.md`, surface to human. (Reserved; not expected to fire in the slice.)

Gate rule: **a verdict cites the artifact it judges. No verdict without evidence on disk.**

## 7. Artifact contracts

| Artifact | Written by | Contains |
|---|---|---|
| `STAGE_PLAN.md` | Planner | STAGE goal → atomic STEPs + acceptance criteria per STEP |
| `STAGE_REVIEW.md` | Reviewer | Verdict on plan well-posedness + reasons |
| `STEP_NN_OUTPUT.md` | Implementer | What changed, which files, why; diff summary; assumptions |
| `STEP_NN_CHECK.md` | Critic + controllers | Reality-based results; each verdict's PASS/FAIL + evidence |
| `issues.md` | any agent | Open problems, unverified assumptions, drift |
| `last_verified_commit.md` | engine | One line: last commit hash that passed every gate |
| `DECISIONS.md` | engine | Append-only audit log of every verdict |

## 8. Success criteria (definition of "proven")

1. The workflow runs end-to-end unattended and ends green.
2. `target/` contains a working `parse_duration` + passing `unittest` suite.
3. Every artifact exists on disk with cross-referencing verdicts; `DECISIONS.md` is a complete audit trail; `last_verified_commit.md` points at the green commit.
4. **Falsification test:** feed the Implementer a deliberately broken acceptance criterion once and confirm the Critic/controllers catch it and trigger rework instead of committing. *A gate that never says FAIL isn't a gate.*

## 9. Deferred (YAGNI for the slice)

Validation/Scope phases (`10_`/`20_`); SECURITY/DB/MIGRATION/ARCH controllers; parallel STEPs; the hardened `PreToolUse` commit hook; Operator/prod rollout; Obsidian-the-app integration. All have clean insertion points; none are needed to prove the loop.

## 10. Extensibility path (next sub-projects, not now)

1. Point the Implementer/Explorer at the `easymed` repo; swap the controller validation command (Python `unittest` → the TS/test toolchain easymed uses).
2. Add B's hardened commit hook and SECURITY/DB/MIGRATION controllers (real risk surface).
3. Add the Validation + Scope front-end phases (`10_`/`20_`) and per-phase workflows.
4. Reintroduce human gates at STAGE-plan approval and prod rollout, permanently for medical/production-data steps.

---

## One-line creed (pin to top of `ORCHESTRATOR.md`)

> Read state from disk → build a bounded frame → run one atomic agent task → validate at a gate → if PASS write the artifact and advance, if FAIL rework. The model is the worker; the vault is the truth.
