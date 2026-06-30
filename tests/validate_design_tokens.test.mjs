import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('DESIGN_TOKENS.md documents the token system', () => {
  const t = readFileSync('40_DESIGN/DESIGN_TOKENS.md', 'utf8')
  for (const k of ['brand', 'neutral', 'type scale', 'spacing', 'radius']) {
    assert.match(t, new RegExp(k, 'i'), `missing token group: ${k}`)
  }
})

test('tokens.ts exports a tokens object with brand + radius', () => {
  const t = readFileSync('target/ui/src/tokens.ts', 'utf8')
  assert.match(t, /export const tokens/, 'tokens.ts must export `tokens`')
  assert.match(t, /brand/, 'tokens must include brand palette')
  assert.match(t, /radius/, 'tokens must include radius')
})
