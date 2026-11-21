import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { corpusGate, readKnownFailures } from './corpus-gate.ts'

import type { CorpusRow } from './corpus.ts'

const GOOD = 'a'.repeat(64)
const BROKEN = 'b'.repeat(64)

function pine(hash: string, verdict: 'valid' | 'fails'): CorpusRow {
  return {
    slug: 'pine-hollow',
    revision: 5,
    hash,
    storedBytes: 1,
    verdict,
    reason: verdict === 'fails' ? 'section-invalid: x' : undefined,
    cached: true,
    deprecations: [],
  }
}

// SHARD-COMPAT FE5: a release blocks on a stranded shard (Pine, here) unless it is a known failure with an owner.
describe('corpusGate', (): void => {
  const known = readKnownFailures(
    JSON.stringify([
      { hash: BROKEN, slug: 'pine-hollow', revision: 5, owner: 'CP1' },
    ]),
  )

  it('blocks a stranded shard and names it', (): void => {
    const gate = corpusGate([pine(GOOD, 'fails')], known)
    assert.equal(gate.blocking.length, 1)
    assert.match(gate.lines.join('\n'), /BLOCKS THE RELEASE: pine-hollow r5/u)
  })

  it('passes a known failure with its owner, and a clean corpus', (): void => {
    assert.equal(corpusGate([pine(BROKEN, 'fails')], known).blocking.length, 0)
    assert.equal(corpusGate([pine(GOOD, 'valid')], []).blocking.length, 0)
  })

  it('names a known failure that passes now as stale', (): void => {
    assert.match(
      corpusGate([pine(BROKEN, 'valid')], known).lines.join('\n'),
      /stale known failure pine-hollow r5/u,
    )
  })
})
