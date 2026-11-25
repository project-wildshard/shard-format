// Meta QA 11-25 (opus-rel86, J505): the kit's lean move (923d372) brought back a `prepare` script, so repo-kit's
// release refused v0.79.3 ("consumers cannot install this tag"). Hooks are set with pnpm:devPreinstall, as fbaac5e did.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const manifest = readFileSync(
  new URL('../../package.json', import.meta.url),
  'utf8',
)

test('the published package carries no prepare script', (): void => {
  assert.doesNotMatch(manifest, /^\s*"prepare":/mu)
  assert.match(
    manifest,
    /"pnpm:devPreinstall": "[^"]*core\.hooksPath \.githooks/u,
  )
})
