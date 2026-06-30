# Agentic Build System (Vertical Slice) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reusable Claude Code-native "build machine" (vault + role prompts + a Workflow engine + in-script gates) and prove its full loop by having it autonomously build one tiny, hard-gated dummy function.

**Architecture:** A markdown **vault** (folders + role-prompt files + state files) is the source of truth. A single **Workflow script** (`build-loop.mjs`) is the engine: it dispatches each role as a subagent (Planner → Reviewer → [Explorer → Implementer → Critic + controllers] → gated commit), reconstructing every agent's bounded "frame" from disk. Gates live **in the script**: nothing commits unless the Critic *and* all controllers return PASS, and `last_verified_commit` only advances on green. The engine's script sandbox cannot touch the filesystem or git, so all file I/O and git operations are performed by the subagents it dispatches.

**Tech Stack:** Claude Code Workflow tool (orchestration) · subagents (roles) · Obsidian-compatible markdown vault + git (state) · Node 24 `node:test` (vault/engine validators) · Python 3.13 stdlib `unittest` (the dummy task's hard gate).

---

## Conventions for this plan

- All paths are **relative to the workspace root** (`c:\Users\user\Desktop\ailos-agentic system`), which is already a git repo.
- Run every command **from the workspace root**.
- Use the **Bash** tool for shell commands (POSIX syntax). Heredocs are fine.
- The engine file uses the `.mjs` extension so Node treats it as an ES module for syntax validation; the Workflow tool reads it by path regardless of extension.
- Commit messages in this repo end with the `Co-Authored-By` trailer used elsewhere in the repo. For brevity the task commands below omit it; add it when you commit.

## File Structure (created by this plan)

```
00_SYSTEM/
  ORCHESTRATOR.md                       # system state pointers + the creed (Task 3)
  GATES.md                              # PASS / REWORK / PIVOT definitions (Task 2)
  ROLES/
    PLANNER.md REVIEWER.md EXPLORER.md IMPLEMENTER.md CRITIC.md   # (Task 4)
    CONTROLLERS/TEST_COVERAGE.md MARKER_GUARD.md                  # (Task 4)
  engine/
    build-loop.mjs                      # the Workflow engine (Task 6)
    seed/STAGE_01_GOAL.md               # the seed STAGE goal (Task 5)
30_BUILD/
  STAGES/STAGE_01/                      # STAGE_PLAN.md, STAGE_REVIEW.md, STEPS/* (runtime, Task 7)
  issues.md                             # drift / unresolved gate failures (runtime)
  last_verified_commit.md               # last green commit hash (runtime)
99_LOG/DECISIONS.md                     # append-only audit log (runtime)
target/
  test_duration_acceptance.py           # FROZEN acceptance suite — the gate's teeth (Task 5)
  duration.py                           # built by the machine at runtime (Task 7)
tests/
  sanity.test.mjs                       # skeleton exists (Task 1)
  validate_gates.test.mjs               # (Task 2)
  validate_orchestrator.test.mjs        # (Task 3)
  validate_roles.test.mjs               # (Task 4)
  validate_engine.test.mjs              # (Task 6)
.claude/skills/agentic-build/SKILL.md   # human front-door skill (Task 9)
package.json                            # node test runner config (Task 1)
README.md                               # how to run the machine (Task 9)
```

**Design note (who writes the dummy's tests):** We author the **frozen acceptance suite** (`target/test_duration_acceptance.py`) ourselves in Task 5. It is the objective, ungameable definition of done. The machine writes only the *implementation* (`target/duration.py`) to satisfy it. This makes the gate independent of the agent that's being judged.

---

### Task 1: Repo scaffold + Node test harness

**Files:**
- Create: `package.json`
- Create: `tests/sanity.test.mjs`
- Create: vault directories (with `.gitkeep`)

- [ ] **Step 1: Create the directory skeleton**

Run:
```bash
mkdir -p 00_SYSTEM/ROLES/CONTROLLERS 00_SYSTEM/engine/seed \
         30_BUILD/STAGES/STAGE_01/STEPS 99_LOG target tests \
         .claude/skills/agentic-build
# keep otherwise-empty dirs in git
touch 30_BUILD/STAGES/STAGE_01/STEPS/.gitkeep 99_LOG/.gitkeep
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "agentic-build-system",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/"
  }
}
```

- [ ] **Step 3: Write the sanity test**

`tests/sanity.test.mjs`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

test('vault skeleton exists', () => {
  const dirs = [
    '00_SYSTEM', '00_SYSTEM/ROLES', '00_SYSTEM/ROLES/CONTROLLERS',
    '00_SYSTEM/engine', '00_SYSTEM/engine/seed',
    '30_BUILD/STAGES/STAGE_01/STEPS', '99_LOG', 'target', 'tests',
  ]
  for (const d of dirs) assert.ok(existsSync(d), `missing dir: ${d}`)
})
```

- [ ] **Step 4: Run the test**

Run: `node --test tests/`
Expected: `# pass 1`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: vault skeleton + node test harness"
```

---

### Task 2: `GATES.md` (gate definitions)

**Files:**
- Test: `tests/validate_gates.test.mjs`
- Create: `00_SYSTEM/GATES.md`

- [ ] **Step 1: Write the failing validator**

`tests/validate_gates.test.mjs`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('GATES.md defines PASS / REWORK / PIVOT and the evidence rule', () => {
  const t = readFileSync('00_SYSTEM/GATES.md', 'utf8')
  for (const k of ['PASS', 'REWORK', 'PIVOT']) assert.match(t, new RegExp(`\\b${k}\\b`), `missing ${k}`)
  assert.match(t, /cites the artifact/i, 'missing the no-verdict-without-evidence rule')
  assert.match(t, /2 retries|two retries/i, 'missing the retry bound')
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node --test tests/validate_gates.test.mjs`
Expected: FAIL — `ENOENT` / file not found for `00_SYSTEM/GATES.md`.

- [ ] **Step 3: Write `00_SYSTEM/GATES.md`**

```markdown
# Gates

A STEP or STAGE advances only by passing a gate. **Every verdict cites the artifact it judges. No verdict without evidence on disk.**

## PASS
All acceptance criteria met with on-disk evidence; tests green; every controller green.
Action: write the artifact, commit, and advance `last_verified_commit`.

## REWORK
Defects found. The verdict must cite the artifact and the specific failing criterion.
Action: return to the producing role with the cited failures. Increment the try counter.
Bound: **2 retries (3 total tries).** On exhaustion: halt the STEP, append to `30_BUILD/issues.md`, and do NOT commit.

## PIVOT
The STEP or plan is mis-posed — its criteria are unsatisfiable or wrong.
Action: halt, append to `30_BUILD/issues.md`, surface to a human. (Reserved; not expected to fire in the slice.)
```

- [ ] **Step 4: Run the validator to confirm it passes**

Run: `node --test tests/validate_gates.test.mjs`
Expected: `# pass 1`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add 00_SYSTEM/GATES.md tests/validate_gates.test.mjs
git commit -m "feat: gate definitions (PASS/REWORK/PIVOT)"
```

---

### Task 3: `ORCHESTRATOR.md` (system state + creed)

**Files:**
- Test: `tests/validate_orchestrator.test.mjs`
- Create: `00_SYSTEM/ORCHESTRATOR.md`

- [ ] **Step 1: Write the failing validator**

`tests/validate_orchestrator.test.mjs`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('ORCHESTRATOR.md carries the creed and the state pointers', () => {
  const t = readFileSync('00_SYSTEM/ORCHESTRATOR.md', 'utf8')
  assert.match(t, /the model is the worker; the vault is the truth/i, 'missing creed')
  for (const k of ['Phase', 'Stage', 'Step', 'last_verified_commit']) {
    assert.match(t, new RegExp(k, 'i'), `missing pointer: ${k}`)
  }
  assert.match(t, /build-loop\.mjs/, 'missing engine pointer')
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node --test tests/validate_orchestrator.test.mjs`
Expected: FAIL — file not found.

- [ ] **Step 3: Write `00_SYSTEM/ORCHESTRATOR.md`**

```markdown
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
```

- [ ] **Step 4: Run the validator to confirm it passes**

Run: `node --test tests/validate_orchestrator.test.mjs`
Expected: `# pass 1`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add 00_SYSTEM/ORCHESTRATOR.md tests/validate_orchestrator.test.mjs
git commit -m "feat: orchestrator state file + creed"
```

---

### Task 4: Role prompt files (7 files)

These markdown files are the **single source of truth for each agent's behavior**. The engine injects them by path at runtime.

**Files:**
- Test: `tests/validate_roles.test.mjs`
- Create: `00_SYSTEM/ROLES/PLANNER.md`, `REVIEWER.md`, `EXPLORER.md`, `IMPLEMENTER.md`, `CRITIC.md`
- Create: `00_SYSTEM/ROLES/CONTROLLERS/TEST_COVERAGE.md`, `MARKER_GUARD.md`

- [ ] **Step 1: Write the failing validator**

`tests/validate_roles.test.mjs`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const REQUIRED = [
  ['00_SYSTEM/ROLES/PLANNER.md',                     [/atomic/i, /acceptance criteria/i, /"steps"/]],
  ['00_SYSTEM/ROLES/REVIEWER.md',                    [/well-posed/i, /PASS/, /REWORK/]],
  ['00_SYSTEM/ROLES/EXPLORER.md',                    [/read-only/i, /"context"/]],
  ['00_SYSTEM/ROLES/IMPLEMENTER.md',                 [/ONE atomic/i, /do NOT modify/i, /"files_changed"/]],
  ['00_SYSTEM/ROLES/CRITIC.md',                      [/run the tests/i, /unittest/, /"verdict"/]],
  ['00_SYSTEM/ROLES/CONTROLLERS/TEST_COVERAGE.md',   [/unittest/, /TEST_COVERAGE/]],
  ['00_SYSTEM/ROLES/CONTROLLERS/MARKER_GUARD.md',    [/git diff/i, /MARKER_GUARD/, /TODO/]],
]

for (const [file, patterns] of REQUIRED) {
  test(`role file ${file} is present and well-formed`, () => {
    const t = readFileSync(file, 'utf8')
    for (const p of patterns) assert.match(t, p, `${file} missing ${p}`)
  })
}
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node --test tests/validate_roles.test.mjs`
Expected: FAIL — files not found.

- [ ] **Step 3: Write `00_SYSTEM/ROLES/PLANNER.md`**

```markdown
# Role: PLANNER

You decompose a STAGE goal into atomic, sequentially-buildable STEPs. You plan only — you never write implementation code.

Inputs (exact paths given in your task): the STAGE goal, and the frozen acceptance tests.
Output: write `STAGE_PLAN.md` to the exact path given, AND return structured `steps`.

Rules:
- Each STEP is ATOMIC: one file / one unit of behavior, independently verifiable.
- Each STEP lists the exact files it will touch and explicit, testable acceptance criteria.
- Derive criteria from the frozen acceptance tests — every test must map to at least one criterion.
- Prefer the FEWEST steps that keep each step atomic. For this dummy task, ONE STEP is correct.

`STAGE_PLAN.md` format:
    # STAGE_01 Plan
    ## Goal
    <restate the goal>
    ## STEPs
    ### STEP_01 — <title>
    - Files: <paths>
    - Acceptance criteria:
      - <criterion> (maps to <test name>)

Return: `{ "steps": [ { "id": "STEP_01", "title": "...", "files": ["..."], "acceptance_criteria": ["..."] } ] }`
```

- [ ] **Step 4: Write `00_SYSTEM/ROLES/REVIEWER.md`**

```markdown
# Role: REVIEWER

You judge whether the STAGE plan is WELL-POSED — not whether it is implemented.

Input: `STAGE_PLAN.md` (exact path given). Output: write `STAGE_REVIEW.md` to the given path and return a verdict.

PASS only if ALL hold:
- every STEP is atomic;
- every STEP has testable acceptance criteria mapped to the frozen tests;
- files to touch are explicit;
- the STEPs fully cover the goal.
Otherwise REWORK, with specific reasons.

`STAGE_REVIEW.md` format: the verdict, then numbered reasons, each citing the part of the plan it judges.
Gate rule: no verdict without citing the artifact.

Return: `{ "verdict": "PASS" | "REWORK", "reasons": ["..."] }`
```

- [ ] **Step 5: Write `00_SYSTEM/ROLES/EXPLORER.md`**

```markdown
# Role: EXPLORER (read-only)

You gather the minimal context the Implementer needs. You NEVER write to `target/` and you write no artifact file.

Input: `target/` (read-only). Output: a concise context string only.

Report: existing files/functions relevant to the STEP, conventions in use, and anything that constrains the implementation. If `target/` is empty or trivial, say so plainly in one line.

Return: `{ "context": "<concise notes>" }`
```

- [ ] **Step 6: Write `00_SYSTEM/ROLES/IMPLEMENTER.md`**

```markdown
# Role: IMPLEMENTER

You perform ONE atomic STEP. You write ONLY the files the STEP lists.

Inputs: the STEP + its acceptance criteria + the Explorer context + the frozen acceptance tests (read them to understand the contract; do NOT modify them).
Output: the code file(s) for the STEP, and `STEP_NN_OUTPUT.md` at the exact path given.

Rules:
- Make the frozen acceptance tests pass. Do NOT edit the tests.
- No leftover markers: no TODO / FIXME / XXX / HACK / "placeholder" / debug prints.
- Minimal and correct. No scope creep beyond the STEP's listed files.
- If this is a REWORK attempt, fix EXACTLY the cited gate failures and nothing else.

`STEP_NN_OUTPUT.md` format: what changed, which files, why, assumptions made, and how the change satisfies each acceptance criterion.

Return: `{ "files_changed": ["..."], "summary": "..." }`
```

- [ ] **Step 7: Write `00_SYSTEM/ROLES/CRITIC.md`**

```markdown
# Role: CRITIC (reality-based gate)

You decide PASS / FAIL for a STEP by checking REALITY, not claims. Structural success never implies factual success — run the tests yourself.

Inputs: `STEP_NN_OUTPUT.md` and the frozen acceptance tests (exact paths given).
You MUST run: `python -m unittest discover -s target -p "test_*.py"`.

PASS only if every test passes AND the output genuinely satisfies every acceptance criterion.
FAIL otherwise, listing `failing_criteria` with the test/output evidence.

Output: write `STEP_NN_CHECK.md` (verdict + evidence + per-criterion result) to the given path.

Return: `{ "verdict": "PASS" | "FAIL", "evidence": "<test output excerpt>", "failing_criteria": ["..."] }`
```

- [ ] **Step 8: Write `00_SYSTEM/ROLES/CONTROLLERS/TEST_COVERAGE.md`**

```markdown
# Controller: TEST_COVERAGE

Run: `python -m unittest discover -s target -p "test_*.py"`.
PASS only if the run reports OK with zero failures and zero errors. Quote the unittest summary line as evidence.

Return: `{ "name": "TEST_COVERAGE", "verdict": "PASS" | "FAIL", "evidence": "<unittest summary>" }`
```

- [ ] **Step 9: Write `00_SYSTEM/ROLES/CONTROLLERS/MARKER_GUARD.md`**

```markdown
# Controller: MARKER_GUARD

Inspect the changed files via `git diff` (staged and unstaged) and the working tree of the STEP's files.
FAIL if any leftover marker is present: TODO, FIXME, XXX, HACK, "placeholder", debug prints, or any stray all-caps junk token (e.g. a random marker like `QZXPBDZ`).
PASS only if the diff is clean of such markers.

Return: `{ "name": "MARKER_GUARD", "verdict": "PASS" | "FAIL", "evidence": "<offending lines, or 'clean'>" }`
```

- [ ] **Step 10: Run the validator to confirm all role files pass**

Run: `node --test tests/validate_roles.test.mjs`
Expected: `# pass 7`, `# fail 0`.

- [ ] **Step 11: Commit**

```bash
git add 00_SYSTEM/ROLES tests/validate_roles.test.mjs
git commit -m "feat: role prompt files (planner, reviewer, explorer, implementer, critic, 2 controllers)"
```

---

### Task 5: Seed STAGE goal + FROZEN acceptance suite

The acceptance suite is the gate's teeth. We commit it **red** (no `duration.py` yet); the machine makes it green in Task 7.

**Files:**
- Create: `00_SYSTEM/engine/seed/STAGE_01_GOAL.md`
- Create: `target/test_duration_acceptance.py`

- [ ] **Step 1: Write the seed goal**

`00_SYSTEM/engine/seed/STAGE_01_GOAL.md`:
```markdown
# STAGE_01 Goal

Build a small, dependency-free Python utility `parse_duration(s)` in `target/duration.py`.

It converts a human duration string into total **seconds** (an `int`):
- `"1h30m"` → 5400, `"45s"` → 45, `"2h"` → 7200, `"10m"` → 600, `"1h1m1s"` → 3661
- leading / trailing whitespace tolerated
- raises `ValueError` on empty string, garbage, or unknown units

The definition of done is the frozen acceptance suite at `target/test_duration_acceptance.py`.
Do NOT modify the tests; write `target/duration.py` so they pass.

Constraints: standard library only; no leftover markers; the only code file is `target/duration.py`.
```

- [ ] **Step 2: Write the frozen acceptance suite**

`target/test_duration_acceptance.py`:
```python
import unittest

from duration import parse_duration


class TestParseDuration(unittest.TestCase):
    def test_hours_minutes(self):
        self.assertEqual(parse_duration("1h30m"), 5400)

    def test_seconds_only(self):
        self.assertEqual(parse_duration("45s"), 45)

    def test_hours_only(self):
        self.assertEqual(parse_duration("2h"), 7200)

    def test_minutes_only(self):
        self.assertEqual(parse_duration("10m"), 600)

    def test_combined_all_units(self):
        self.assertEqual(parse_duration("1h1m1s"), 3661)

    def test_surrounding_whitespace(self):
        self.assertEqual(parse_duration("  2h  "), 7200)

    def test_empty_string_raises(self):
        with self.assertRaises(ValueError):
            parse_duration("")

    def test_garbage_raises(self):
        with self.assertRaises(ValueError):
            parse_duration("abc")

    def test_unknown_unit_raises(self):
        with self.assertRaises(ValueError):
            parse_duration("5x")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run the suite to confirm it is RED (expected)**

Run: `python -m unittest discover -s target -p "test_*.py"`
Expected: FAIL — `ModuleNotFoundError: No module named 'duration'` (the implementation does not exist yet). This is the failing test the machine will satisfy.

- [ ] **Step 4: Commit**

```bash
git add 00_SYSTEM/engine/seed/STAGE_01_GOAL.md target/test_duration_acceptance.py
git commit -m "feat: STAGE_01 seed goal + frozen acceptance suite (red)"
```

---

### Task 6: The Workflow engine `build-loop.mjs`

**Files:**
- Test: `tests/validate_engine.test.mjs`
- Create: `00_SYSTEM/engine/build-loop.mjs`

The engine is a Workflow script: it runs in a sandbox with **no filesystem/git access**, so every read/write/commit is delegated to a subagent. The validator below compiles the script body as an async function (which legalizes the top-level `await`/`return` the Workflow runtime relies on) to catch syntax errors without executing it, and asserts the key safety invariants are present.

- [ ] **Step 1: Write the failing validator**

`tests/validate_engine.test.mjs`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

test('engine compiles as an async-wrapped Workflow body (syntax only)', () => {
  let src = readFileSync('00_SYSTEM/engine/build-loop.mjs', 'utf8')
  src = src.replace(/export\s+const\s+meta/, 'const meta') // strip the ESM export for the wrapper
  assert.doesNotThrow(
    () => new AsyncFunction('agent', 'parallel', 'pipeline', 'phase', 'log', 'args', 'budget', 'workflow', src),
    'engine has a syntax error',
  )
})

test('engine enforces gate safety invariants', () => {
  const src = readFileSync('00_SYSTEM/engine/build-loop.mjs', 'utf8')
  assert.match(src, /MAX_RETRIES\s*=\s*2/, 'retry bound must be 2')
  assert.match(src, /gate\.green/, 'must compute a green gate')
  assert.match(src, /git commit/, 'must commit on green')
  assert.match(src, /mode === 'falsify'/, 'must support falsify mode')
  assert.match(src, /export const meta/, 'must export a meta block')
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node --test tests/validate_engine.test.mjs`
Expected: FAIL — file not found.

- [ ] **Step 3: Write `00_SYSTEM/engine/build-loop.mjs`**

```js
export const meta = {
  name: 'build-loop',
  description: 'Agentic build engine: Planner -> Reviewer -> [Explorer -> Implementer -> Critic + controllers] -> gated commit. The vault is the truth; the model is the worker.',
  phases: [
    { title: 'Plan' },
    { title: 'Build' },
    { title: 'Gate' },
    { title: 'Record' },
  ],
}

// ---------- paths (relative to workspace root) ----------
const ROLES = '00_SYSTEM/ROLES'
const STAGE_DIR = '30_BUILD/STAGES/STAGE_01'
const STEPS_DIR = STAGE_DIR + '/STEPS'
const ISSUES = '30_BUILD/issues.md'
const LVC = '30_BUILD/last_verified_commit.md'
const DECISIONS = '99_LOG/DECISIONS.md'
const SEED = '00_SYSTEM/engine/seed/STAGE_01_GOAL.md'
const ACCEPTANCE = 'target/test_duration_acceptance.py'
const TEST_CMD = 'python -m unittest discover -s target -p "test_*.py"'
const MAX_RETRIES = 2
const falsify = !!(args && args.mode === 'falsify')

// ---------- structured-output schemas ----------
const PLAN_SCHEMA = { type: 'object', required: ['steps'], properties: { steps: { type: 'array', items: {
  type: 'object', required: ['id', 'title', 'files', 'acceptance_criteria'], properties: {
    id: { type: 'string' }, title: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    acceptance_criteria: { type: 'array', items: { type: 'string' } } } } } } }
const VERDICT_SCHEMA = { type: 'object', required: ['verdict', 'reasons'], properties: {
  verdict: { enum: ['PASS', 'REWORK'] }, reasons: { type: 'array', items: { type: 'string' } } } }
const EXPLORE_SCHEMA = { type: 'object', required: ['context'], properties: { context: { type: 'string' } } }
const IMPL_SCHEMA = { type: 'object', required: ['files_changed', 'summary'], properties: {
  files_changed: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } } }
const CHECK_SCHEMA = { type: 'object', required: ['verdict', 'evidence'], properties: {
  verdict: { enum: ['PASS', 'FAIL'] }, evidence: { type: 'string' },
  failing_criteria: { type: 'array', items: { type: 'string' } } } }
const CTRL_SCHEMA = { type: 'object', required: ['name', 'verdict', 'evidence'], properties: {
  name: { type: 'string' }, verdict: { enum: ['PASS', 'FAIL'] }, evidence: { type: 'string' } } }
const COMMIT_SCHEMA = { type: 'object', required: ['committed', 'commit_hash'], properties: {
  committed: { type: 'boolean' }, commit_hash: { type: 'string' } } }

// ---------- frame builder: a bounded prompt from a role file + exact paths ----------
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
  steps = [{ id: 'STEP_01', title: 'parse_duration (falsification: planted broken file)',
    files: ['target/duration.py'], acceptance_criteria: ['the frozen acceptance suite must pass'] }]
} else {
  phase('Plan')
  let plan, review, ptries = 0
  do {
    plan = await agent(
      frame(ROLES + '/PLANNER.md', [SEED, ACCEPTANCE], STAGE_DIR + '/STAGE_PLAN.md',
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
      frame(ROLES + '/EXPLORER.md', ['target/'], '',
        'Gather minimal read-only context for ' + step.id + ' (' + step.title + '). Files in scope: ' + step.files.join(', ') + '.'),
      { label: 'explorer:' + step.id, phase: 'Build', schema: EXPLORE_SCHEMA }) || ctx
  }

  // ---- Implementer -> Gate, bounded rework ----
  let gate, itries = 0
  do {
    if (!falsify) {
      phase('Build')
      const reworkNote = (itries > 0 && gate)
        ? '\nThis is REWORK attempt ' + itries + '. The gate FAILED with: ' + JSON.stringify(gate.fails) + '. Fix EXACTLY these and nothing else.'
        : ''
      const impl = await agent(
        frame(ROLES + '/IMPLEMENTER.md', [ACCEPTANCE], outPath,
          'Implement ' + step.id + ': ' + step.title + '. Acceptance criteria:\n- ' + step.acceptance_criteria.join('\n- ') +
          '\nExplorer context:\n' + ctx.context +
          '\nMake the frozen acceptance tests pass; do NOT modify them. Write/modify ONLY: ' + step.files.join(', ') + '. Then write ' + outPath + '.' + reworkNote),
        { label: 'implementer:' + step.id, phase: 'Build', schema: IMPL_SCHEMA })
      if (!impl) return { ok: false, where: 'implement', step: step.id, reason: 'implementer produced nothing' }
    }

    // ---- Gate: Critic + controllers (parallel, read-only judging) ----
    phase('Gate')
    const judged = await parallel([
      function () { return agent(
        frame(ROLES + '/CRITIC.md', [outPath, ACCEPTANCE], checkPath,
          'Validate ' + step.id + ' against its acceptance criteria. You MUST run the tests yourself: `' + TEST_CMD + '`. ' +
          (falsify ? 'The OUTPUT artifact may be absent; judge solely by running the tests. ' : '') +
          'Acceptance criteria:\n- ' + step.acceptance_criteria.join('\n- ') + '\nWrite ' + checkPath + ' and return the verdict.'),
        { label: 'critic:' + step.id, phase: 'Gate', schema: CHECK_SCHEMA }) },
      function () { return agent(
        frame(ROLES + '/CONTROLLERS/TEST_COVERAGE.md', [], '',
          'Run `' + TEST_CMD + '`. PASS only if it reports OK with zero failures/errors.'),
        { label: 'ctrl:test:' + step.id, phase: 'Gate', schema: CTRL_SCHEMA }) },
      function () { return agent(
        frame(ROLES + '/CONTROLLERS/MARKER_GUARD.md', [], '',
          'Inspect the changed files (' + step.files.join(', ') + ') via `git diff` and the working tree. FAIL on any leftover marker.'),
        { label: 'ctrl:marker:' + step.id, phase: 'Gate', schema: CTRL_SCHEMA }) },
    ])
    const critic = judged[0]
    const controllers = judged.slice(1).filter(Boolean)
    const fails = []
    if (!critic || critic.verdict !== 'PASS') fails.push({ critic: critic ? (critic.failing_criteria || critic.evidence) : 'critic missing' })
    for (const c of controllers) if (c.verdict !== 'PASS') fails.push({ [c.name]: c.evidence })
    gate = { green: fails.length === 0, fails: fails, critic: critic, controllers: controllers }
    itries++
  } while (!falsify && !gate.green && itries <= MAX_RETRIES)

  // ---- Falsification mode: return the gate verdict, never commit ----
  if (falsify) {
    return { ok: !gate.green, mode: 'falsify', committed: false, gate: gate,
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

  // ---- GREEN: commit + record (a recorder agent performs git/fs; the script cannot) ----
  phase('Record')
  const rec = await agent(
    'All gates passed for ' + step.id + '. Do EXACTLY, in order, using Bash:\n' +
    '1. `git add -A`\n' +
    '2. `git commit -m "build(' + step.id + '): ' + step.title + '"`\n' +
    '3. `git rev-parse HEAD` to capture the commit hash\n' +
    '4. Write that hash as the ONLY line of ' + LVC + '\n' +
    '5. Append one line to ' + DECISIONS + ' (read it first if present, then append, then write back): "<UTC date>  ' + step.id + '  PASS  <hash>"\n' +
    '6. `git add ' + LVC + ' ' + DECISIONS + ' && git commit -m "chore(' + step.id + '): record verified commit"`\n' +
    'Return {"committed":true,"commit_hash":"<hash>"}.',
    { label: 'record:' + step.id, phase: 'Record', schema: COMMIT_SCHEMA })
  results.push({ step: step.id, committed: !!(rec && rec.committed), commit_hash: rec && rec.commit_hash, gate: gate })
}

return { ok: true, mode: falsify ? 'falsify' : 'normal', results: results }
```

- [ ] **Step 4: Run the validator to confirm it passes**

Run: `node --test tests/validate_engine.test.mjs`
Expected: `# pass 2`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add 00_SYSTEM/engine/build-loop.mjs tests/validate_engine.test.mjs
git commit -m "feat: build-loop Workflow engine + syntax/invariant validator"
```

---

### Task 7: Integration run — prove the loop (MAIN SESSION)

> **This task runs in the main Claude Code session, not a subagent.** It invokes the Workflow tool, which the user has already opted into ("fully autonomous Workflow"). Do not delegate it to a subagent.

- [ ] **Step 1: Confirm all unit validators are green first**

Run: `node --test tests/`
Expected: all tests pass (`# fail 0`). Do not proceed otherwise.

- [ ] **Step 2: Run the engine via the Workflow tool**

Invoke the `Workflow` tool with:
```
{ "scriptPath": "00_SYSTEM/engine/build-loop.mjs" }
```
This runs in the background; a task-notification arrives on completion. Watch progress with `/workflows` if desired.

Expected final return value (shape):
```
{ "ok": true, "mode": "normal", "results": [ { "step": "STEP_01", "committed": true, "commit_hash": "<hash>", "gate": { "green": true, ... } } ] }
```

- [ ] **Step 3: Verify the dummy was actually built and is green**

Run: `python -m unittest discover -s target -p "test_*.py" -v`
Expected: `OK` — all 9 tests pass. `target/duration.py` now exists.

- [ ] **Step 4: Verify the artifacts exist on disk**

Run:
```bash
ls 30_BUILD/STAGES/STAGE_01/ 30_BUILD/STAGES/STAGE_01/STEPS/
cat 30_BUILD/last_verified_commit.md
cat 99_LOG/DECISIONS.md
```
Expected: `STAGE_PLAN.md`, `STAGE_REVIEW.md`, and `STEPS/STEP_01_OUTPUT.md`, `STEP_01_CHECK.md` exist; `last_verified_commit.md` holds one commit hash; `DECISIONS.md` has a `STEP_01  PASS  <hash>` line.

- [ ] **Step 5: Verify the gated commit happened**

Run: `git log --oneline -5`
Expected: a `build(STEP_01): ...` commit and a `chore(STEP_01): record verified commit` commit at the top. The hash in `last_verified_commit.md` matches the `build(STEP_01)` commit.

- [ ] **Step 6: Commit any remaining run artifacts (if the recorder left anything unstaged)**

Run:
```bash
git status --porcelain
# if anything is unstaged:
git add -A && git commit -m "chore: capture STAGE_01 run artifacts"
```

---

### Task 8: Falsification run — prove the gate can say FAIL (MAIN SESSION)

> Also a **main-session** task. This proves the gate blocks a broken build. A gate that never fails is not a gate.

- [ ] **Step 1: Record the current HEAD (the green baseline)**

Run: `git rev-parse HEAD > /tmp/baseline_head.txt && cat /tmp/baseline_head.txt`
Expected: prints the current commit hash. (On Windows the scratchpad path also works; `/tmp` is fine under Git Bash.)

- [ ] **Step 2: Plant a deliberately broken implementation**

Run:
```bash
cat > target/duration.py <<'PY'
def parse_duration(s):
    return 0  # deliberately wrong: ignores input entirely
PY
python -m unittest discover -s target -p "test_*.py" 2>&1 | tail -3
```
Expected: the suite now FAILS (multiple assertion errors). Good — the gate has something real to catch.

- [ ] **Step 3: Run the engine in falsify mode (MAIN SESSION)**

Invoke the `Workflow` tool with:
```
{ "scriptPath": "00_SYSTEM/engine/build-loop.mjs", "args": { "mode": "falsify" } }
```

Expected final return value:
```
{ "ok": true, "mode": "falsify", "committed": false,
  "note": "OK: gate correctly FAILED the deliberately broken file",
  "gate": { "green": false, ... } }
```

- [ ] **Step 4: Verify NO new commit was created**

Run:
```bash
test "$(git rev-parse HEAD)" = "$(cat /tmp/baseline_head.txt)" && echo "PASS: HEAD unchanged" || echo "FAIL: a commit slipped through"
```
Expected: `PASS: HEAD unchanged`. This is the core proof — the broken build did **not** advance `last_verified_commit` and did **not** commit.

- [ ] **Step 5: Restore the green state**

Run:
```bash
git checkout -- .          # restore tracked files the falsify run dirtied (duration.py, STEP_01_CHECK.md)
git status --porcelain     # expect empty
python -m unittest discover -s target -p "test_*.py" 2>&1 | tail -1
```
Expected: working tree clean; tests `OK` again (the real `duration.py` is restored from the green commit).

---

### Task 9: Human front-door skill + README

**Files:**
- Create: `.claude/skills/agentic-build/SKILL.md`
- Create: `README.md`

- [ ] **Step 1: Write the front-door skill**

`.claude/skills/agentic-build/SKILL.md`:
```markdown
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
- No commit without the Critic AND every controller green.
- `last_verified_commit` advances only on green; rework is bounded to 2 retries, then the failure is logged to `30_BUILD/issues.md`.

## Extending to a real codebase (e.g. easymed)
Point the role tasks at the real repo, swap `TEST_CMD` in `build-loop.mjs` to that repo's test command, add SECURITY/DB/MIGRATION controllers as new files under `00_SYSTEM/ROLES/CONTROLLERS/`, and reintroduce human gates for medical/production steps.
```

- [ ] **Step 2: Write the README**

`README.md`:
```markdown
# Agentic Build System

A Claude Code-native machine that builds working code one verified atomic step at a time. The markdown vault + git are the source of truth; subagents are the workers; a Workflow script is the engine.

- Design spec: `docs/superpowers/specs/2026-06-30-agentic-build-system-design.md`
- Implementation plan: `docs/superpowers/plans/2026-06-30-agentic-build-system-slice.md`
- Engine: `00_SYSTEM/engine/build-loop.mjs`
- How to run: see the `agentic-build` skill (`.claude/skills/agentic-build/SKILL.md`).

## Test the machine's own scaffolding
`node --test tests/`

## Run the build loop
Invoke the Workflow tool on `00_SYSTEM/engine/build-loop.mjs`. The loop:
Planner → Reviewer → (per STEP) Explorer → Implementer → Critic + controllers → gated commit.

The creed: **read state from disk → build a bounded frame → run one atomic agent task → validate at a gate → if PASS advance, if FAIL rework. The model is the worker; the vault is the truth.**
```

- [ ] **Step 3: Confirm everything still validates**

Run: `node --test tests/`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/agentic-build/SKILL.md README.md
git commit -m "docs: agentic-build front-door skill + README"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- §2 invariants (atomic step, sequential, gate-before-progress) → enforced in the engine (Task 6) and asserted by `validate_engine.test.mjs`.
- §3 locked decisions (Claude Code-native, machine+dummy, autonomous Workflow, Approach A, `unittest` validator) → realized across Tasks 1–9.
- §4.1 vault structure → Tasks 1–4. §4.2 roles → Task 4. §4.3 workflow engine → Task 6. §4.4 memory discipline → `frame()` + `ORCHESTRATOR.md` (Tasks 3, 6).
- §5 dummy task → Task 5 (frozen suite) + Task 7 (machine builds it).
- §6 gate definitions → Task 2. §7 artifact contracts → produced at runtime (Task 7), verified in Task 7 Steps 4–5.
- §8 success criteria → Task 7 (1–3) + Task 8 falsification (§8.4).
- §9 deferred items → not implemented (correct). §10 extensibility → documented in Task 9 SKILL.md.

**Placeholder scan:** No TBD/TODO left in plan content. (The MARKER_GUARD role and tests intentionally mention the literal token "TODO" as a thing to *detect* — not a placeholder.)

**Type consistency:** Schema field names (`steps`, `verdict`, `reasons`, `context`, `files_changed`, `summary`, `evidence`, `failing_criteria`, `name`, `committed`, `commit_hash`) are used identically in the engine and the role prompts. `TEST_CMD` string is identical in the engine, the CRITIC/TEST_COVERAGE roles, and the verification commands. Engine filename `build-loop.mjs` is consistent across Tasks 6, 7, 8, 9 and the validators.
```
