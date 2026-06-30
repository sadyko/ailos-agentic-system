import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

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

for (const [file, patterns] of REQUIRED) {
  test(`role file ${file} is present and well-formed`, () => {
    const t = readFileSync(file, 'utf8')
    for (const p of patterns) assert.match(t, p, `${file} missing ${p}`)
  })
}
