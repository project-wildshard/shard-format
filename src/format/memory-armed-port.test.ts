// FORMAT-PRUNE FP27b: admission passes the API catalogue's armed state to the memory gate. With it, the format's own
// `zones` list is never read: a slug the list does not hold refuses when the catalogue arms it, and a listed slug
// only warns when the catalogue does not.
import { expect, test } from 'vitest'

import { ARMED_ZONES, armedZone, zoneArmed } from './memory-armed.ts'
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

test('the fixture slugs sit on either side of the format list', (): void => {
  expect(Object.hasOwn(ARMED_ZONES, LISTED)).toBe(true)
  expect(Object.hasOwn(ARMED_ZONES, UNLISTED)).toBe(false)
})

test("the catalogue's armed state decides, not the format's list", (): void => {
  expect(zoneArmed(armedZone(UNLISTED, true))).toBe(true)
  expect(zoneArmed(armedZone(LISTED, false))).toBe(false)
  expect(zoneArmed(armedZone(LISTED))).toBe(true)
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
  expect(accepts(LISTED)).toBe(false)
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
