import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { migratedVerdict } from './corpus-migrated.ts'
import { packFolder } from './pack.ts'

// J486, SHARD-COMPAT CP1: a stored original the format refuses is judged again through the migration chain; the corpus
// counts it valid when the copy validates, and keeps the stored refusal when the chain changes nothing.

const FIXTURE = fileURLToPath(
  new URL('../test/fixtures/cli-fixture', import.meta.url),
)
const scratch = mkdtempSync(path.join(tmpdir(), 'shard-format-migrated-'))
after((): void => {
  rmSync(scratch, { recursive: true, force: true })
})
const TRUNCATED = 4096

describe('the corpus judges a refused original through the chain', (): void => {
  it('counts the copy valid and names the steps that ran', async (): Promise<void> => {
    const packed = await packFolder(FIXTURE, path.join(scratch, 'fixture.tar'))
    // The fixture spells its format "0.1": the chain writes the four-part spelling, and the copy validates.
    const verdict = await migratedVerdict(
      packed.file,
      true,
      new Error('as stored'),
    )
    assert.equal(verdict.applied[0], 'fp6-four-part-version')
    // Only what no migration mends stays (CP8): both fields are in the build source hash.
    assert.deepEqual(verdict.deprecations, [
      'requires.sdk',
      'requires.capabilities',
    ])
  })

  it('keeps the stored refusal when the chain cannot run', async (): Promise<void> => {
    const packed = await packFolder(FIXTURE, path.join(scratch, 'whole.tar'))
    const cut = path.join(scratch, 'cut.tar')
    const whole = await readFile(packed.file)
    writeFileSync(cut, whole.subarray(0, TRUNCATED))
    const refused = new Error('as stored')
    await assert.rejects(migratedVerdict(cut, true, refused), refused)
  })
})
