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
