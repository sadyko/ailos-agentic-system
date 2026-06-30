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
