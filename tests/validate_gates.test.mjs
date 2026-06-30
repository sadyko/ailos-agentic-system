import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('GATES.md defines PASS / REWORK / PIVOT and the evidence rule', () => {
  const t = readFileSync('00_SYSTEM/GATES.md', 'utf8')
  for (const k of ['PASS', 'REWORK', 'PIVOT']) assert.match(t, new RegExp(`\\b${k}\\b`), `missing ${k}`)
  assert.match(t, /cites the artifact/i, 'missing the no-verdict-without-evidence rule')
  assert.match(t, /2 retries|two retries/i, 'missing the retry bound')
})
