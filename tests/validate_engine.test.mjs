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
