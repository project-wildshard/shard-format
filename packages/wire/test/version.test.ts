import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { WIRE_MAJOR, WIRE_MINOR } from '../src/major.ts'
import { WIRE_PACKAGE_VERSION } from '../src/version.mjs'

// WR8a (opus-wr8, 2026-11-17): the package number is the wire's own. 0.1.0
// shipped a WIRE_MAJOR 1 lock, so a minor could only ship as a patch (which
// the patch-tag rule refuses) and the 14-day clock looked for a tag that
// never existed. `wire-vM.m.p` names WIRE_MAJOR M and WIRE_MINOR m.
const manifest = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { readonly version: string }

test('the package version names the lock wire major and minor', (): void => {
  const [major, minor] = manifest.version.split('.').map(Number)
  assert.deepEqual([major, minor], [WIRE_MAJOR, WIRE_MINOR])
  assert.equal(WIRE_PACKAGE_VERSION, manifest.version)
})
