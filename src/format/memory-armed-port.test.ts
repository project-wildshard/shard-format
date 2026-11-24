// FORMAT-PRUNE FP27b: admission passes the API catalogue's armed state to the memory gate. FP27c: the format keeps no
// armed list, so the catalogue's word is the only one; a bare slug (no word) reports only (J424).
import { expect, test } from 'vitest'

import policy from './memory-armed.json' with { type: 'json' }
import { armedZone, zoneArmed } from './memory-armed.ts'
import { OLDEST_CURRENT_EPOCH, staleRuntimeIssues } from './memory-epoch.ts'
import { hardLineIssue, MEMORY_HARD_BYTES } from './memory-line.ts'
import { policyVerdict } from './policy-verdict.ts'
import { offlineMemoryAdmission } from './shardfile-assets.ts'

const LISTED = 'brasscap-mesa'
const UNLISTED = 'fp27b-new-zone'
const OVER = MEMORY_HARD_BYTES + 1

function accepts(
  owner: string,
  armed?: boolean | ReadonlySet<string>,
): boolean {
  return offlineMemoryAdmission('warn', 'upload', armed).accept({
    stage: 'declared',
    owner,
    id: `${owner}:worst`,
    claimedBytes: 1,
    accountedBytes: 1,
    playingBytes: 1,
    loadingBytes: OVER,
  })
}

test('FP27c: the format keeps the lines and no armed list', (): void => {
  expect(Object.keys(policy)).toEqual(['$doc', 'lines'])
  expect(zoneArmed(LISTED)).toBe(false)
  expect(zoneArmed(armedZone(LISTED))).toBe(false)
})

test("the catalogue's armed state decides, not the format's list", (): void => {
  expect(zoneArmed(armedZone(UNLISTED, true))).toBe(true)
  expect(zoneArmed(armedZone(LISTED, false))).toBe(false)
  expect(zoneArmed(armedZone(LISTED, true))).toBe(true)
  expect(
    hardLineIssue('loading', OVER, armedZone(UNLISTED, true)).severity,
  ).toBe('refusal')
  const warned = hardLineIssue('loading', OVER, armedZone(LISTED, false))
  expect(warned.severity).toBe('warning')
  expect(warned.metric).toContain(`${LISTED} is not armed`)
})

test('offline admission and the stored verdict take the armed port', (): void => {
  expect(accepts(UNLISTED, true)).toBe(false)
  expect(accepts(LISTED, false)).toBe(true)
  expect(accepts(LISTED)).toBe(true)
  expect(accepts(LISTED, true)).toBe(false)
  expect(policyVerdict(armedZone(UNLISTED, true), 'upload', []).armed).toBe(
    true,
  )
  const stale = staleRuntimeIssues(
    { cost: { epoch: 1 } },
    OLDEST_CURRENT_EPOCH,
    { slug: UNLISTED, saveRevision: 1, armed: true },
  )
  expect(stale[0]?.severity).toBe('refusal')
})

test("a host that reads the slug from the file passes the catalogue's armed slugs", (): void => {
  const catalogue = new Set([UNLISTED])
  expect(zoneArmed(armedZone(UNLISTED, catalogue))).toBe(true)
  expect(zoneArmed(armedZone(LISTED, catalogue))).toBe(false)
  expect(zoneArmed(armedZone(undefined, catalogue))).toBe(false)
  expect(accepts(UNLISTED, catalogue)).toBe(false)
  expect(accepts(LISTED, catalogue)).toBe(true)
})
