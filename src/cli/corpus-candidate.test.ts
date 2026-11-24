import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { rename as renameKey } from '../format/format-migration-ops.ts'
import { readTar } from '../format/tar.ts'
import { candidateText, judgeCandidate } from './corpus-candidate.ts'
import { packFolder } from './pack.ts'

import type { Candidate, CandidateFailure } from './corpus-candidate.ts'

// SHARD-COMPAT FE3b: a candidate chain and validator judged beside the current one, on the CLI fixture through the real
// chain. The fixture's `sim/client-scripts` holds `divisor`; the candidates remove it, then rename it.

const FIXTURE = fileURLToPath(
  new URL('../test/fixtures/cli-fixture', import.meta.url),
)
const SCRIPTS = 'sections/sim/client-scripts.json'
const scratch = mkdtempSync(path.join(tmpdir(), 'shard-format-candidate-'))
after((): void => {
  rmSync(scratch, { recursive: true, force: true })
})

function divisorLeft(
  files: ReadonlyMap<string, Uint8Array>,
): readonly CandidateFailure[] {
  const bytes = files.get(SCRIPTS)
  const text = bytes === undefined ? '' : new TextDecoder().decode(bytes)
  return text.includes('"divisor"')
    ? [{ path: SCRIPTS, reason: 'clientScripts.divisor is removed' }]
    : []
}

const drop: Candidate = { id: 'drop-divisor', check: divisorLeft }
const rename: Candidate = {
  id: 'rename-divisor',
  migrations: [
    {
      id: 'fe3b-test-tick-divisor',
      to: '0.1.0.6',
      touches: 'data',
      affects: [],
      apply: renameKey({ section: 'sim/client-scripts' }, ['clientScripts'], {
        from: 'divisor',
        to: 'tickDivisor',
      }),
    },
  ],
  check: divisorLeft,
}
const never: Candidate = {
  id: 'never',
  check: (): readonly CandidateFailure[] => [],
}

async function fixture(): Promise<ReadonlyMap<string, Uint8Array>> {
  const packed = await packFolder(FIXTURE, path.join(scratch, 'fixture.tar'))
  return readTar(readFileSync(packed.file))
}

describe('the corpus judges a candidate beside the current format', (): void => {
  it('a removal with no migration fails by path', async (): Promise<void> => {
    const verdict = judgeCandidate(await fixture(), drop)
    assert.equal(verdict.verdict, 'fails')
    assert.equal(
      candidateText(verdict),
      `fails ${SCRIPTS} clientScripts.divisor is removed`,
    )
  })

  it('the same removal with a rename migration migrates', async (): Promise<void> => {
    const verdict = judgeCandidate(await fixture(), rename)
    assert.equal(verdict.verdict, 'migrates')
    assert.deepEqual(verdict.applied, ['fe3b-test-tick-divisor'])
    assert.equal(candidateText(verdict), 'migrates (fe3b-test-tick-divisor)')
  })

  it('a candidate that touches nothing the original uses stays valid', async (): Promise<void> => {
    assert.equal(judgeCandidate(await fixture(), never).verdict, 'valid')
  })

  it('an original the chain cannot read fails at the chain', (): void => {
    const verdict = judgeCandidate(
      new Map([['shard.json', new Uint8Array([1])]]),
      never,
    )
    assert.equal(verdict.verdict, 'fails')
    assert.equal(verdict.failures[0]?.path, 'chain')
  })
})
