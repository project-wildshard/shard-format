import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { checkRelease } from '../cli/release-ref.ts'

const SCRATCH_ROOT = fileURLToPath(new URL('../../../tmp/', import.meta.url))

// WR6's carried item: an installed copy nested in another git repo (engine's
// node_modules) has no release to hold its lock to, and says so; it never
// throws on the consumer's missing packages/wire.
test('a copy nested in a consumer repo checks no release and does not throw', async (): Promise<void> => {
  mkdirSync(SCRATCH_ROOT, { recursive: true })
  const dir = mkdtempSync(path.join(SCRATCH_ROOT, 'wire-nested-'))
  try {
    execFileSync('git', ['init', '--quiet', dir])
    const nested = path.join(dir, 'node_modules', '@wildshard', 'wire')
    mkdirSync(nested, { recursive: true })
    // oxlint-disable-next-line unicorn/no-useless-undefined -- no `--against` ref
    assert.deepEqual(await checkRelease(nested, '{}', undefined), {
      against: undefined,
      problems: [],
    })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
