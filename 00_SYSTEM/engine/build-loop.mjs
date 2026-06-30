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
// `args` may arrive as a parsed object OR as a raw JSON string depending on the runtime; normalize both.
const ARGS = (function () {
  if (!args) return {}
  if (typeof args === 'string') { try { return JSON.parse(args) } catch (e) { return {} } }
  return args
})()
const falsify = !!(ARGS && ARGS.mode === 'falsify')

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
    const controllerResults = judged.slice(1) // may contain null if a controller agent crashed/returned invalid output
    const fails = []
    if (!critic || critic.verdict !== 'PASS') fails.push({ critic: critic ? (critic.failing_criteria || critic.evidence) : 'critic missing' })
    for (const c of controllerResults) {
      // A null controller (crash / schema miss) is a FAIL, never a silent skip — the gate must not go green with a missing check.
      if (!c) fails.push({ controller: 'a controller agent returned null (crash/invalid output) — treated as FAIL' })
      else if (c.verdict !== 'PASS') fails.push({ [c.name]: c.evidence })
    }
    const controllers = controllerResults.filter(Boolean)
    gate = { green: fails.length === 0, fails: fails, critic: critic, controllers: controllers }
    itries++
  } while (!falsify && !gate.green && itries <= MAX_RETRIES)

  // ---- Falsification mode: return the gate verdict, never commit ----
  // Falsify synthesizes exactly one step (see above), so this returns on the first iteration by design.
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

// Falsify mode returns inside the loop above; reaching here is always normal mode.
// `ok` reflects whether every step actually passed its gate and committed — not merely that the engine ran.
const allCommitted = results.length > 0 && results.every(function (r) { return r.committed })
return { ok: allCommitted, mode: 'normal', allCommitted: allCommitted, results: results }
