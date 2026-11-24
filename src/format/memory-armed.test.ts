// J426 (Jake, 2026-11-18): "get the shard passing the memory gate and then to LOCK THE GATE IN. And make it fail hard /
// mandatory." On J424: only an armed zone refuses; every other zone reports. FORMAT-PRUNE FP27c: which zones are armed
// is the API catalogue's word, which admission passes (`{ slug, armed }`); a bare slug carries none and reports.
import { expect, test } from 'vitest'

import { BUDGET_TIERS } from './budget-tiers.ts'
import { MEMORY_GATES } from './contentBounds.ts'
import {
  ARMED_LINES,
  armedLine,
  armedZone,
  ratchetLimit,
  ratchetSeverity,
  zoneArmed,
} from './memory-armed.ts'
import { OLDEST_CURRENT_EPOCH, staleRuntimeIssues } from './memory-epoch.ts'
import { hardLineIssue, MEMORY_HARD_BYTES } from './memory-line.ts'
import { MemoryAdmission } from './memoryAdmission.ts'
import { offlineMemoryAdmission } from './shardfile-assets.ts'

import type { MemoryAdmissionRequest } from './memoryAdmission.ts'

const ARMED = 'brasscap-mesa'
const UNARMED = 'template'
/** The catalogue's word for Brasscap, as admission passes it (FP27b). */
const ARMED_REF = { slug: ARMED, armed: true } as const
/** The catalogue's armed slugs, as a host that reads the slug from the file passes them. */
const CATALOGUE: ReadonlySet<string> = new Set([
  ARMED,
  'far-reach',
  'driftwood-isle',
  'nalati-grasslands',
  'pine-hollow',
])

function armedRef(slug: string): Readonly<{ slug: string; armed: boolean }> {
  return { slug, armed: CATALOGUE.has(slug) }
}

function request(owner: string, loadingBytes: number): MemoryAdmissionRequest {
  return {
    stage: 'declared',
    owner,
    id: `${owner}:worst`,
    claimedBytes: 1,
    accountedBytes: 1,
    playingBytes: 1,
    loadingBytes,
  }
}

function stale(slug: string): string | undefined {
  return staleRuntimeIssues({ cost: { epoch: 1 } }, OLDEST_CURRENT_EPOCH, {
    slug,
    saveRevision: 1,
    armed: CATALOGUE.has(slug),
  })[0]?.severity
}

test('J426: the catalogue arms Brasscap at the J410 lines; a bare slug is not armed (FP27c)', (): void => {
  expect(ARMED_LINES).toEqual({ playing: 1e9, loading: 1.5e9 })
  expect(zoneArmed(ARMED_REF)).toBe(true)
  expect(zoneArmed(ARMED)).toBe(false)
  expect(zoneArmed(armedRef(UNARMED))).toBe(false)
  expect([zoneArmed(), zoneArmed('toString')]).toEqual([false, false])
})

test('J445: armed zones use the common lines for a new shard revision', (): void => {
  for (const slug of CATALOGUE) {
    expect(armedLine(armedRef(slug), 'playing'), slug).toBe(ARMED_LINES.playing)
    expect(armedLine(armedRef(slug), 'loading'), slug).toBe(ARMED_LINES.loading)
    expect(armedLine(slug, 'loading'), slug).toBeUndefined()
  }
})

test('J445: Far Reach at 1,027 MB playing reports and admits under 1.5 GB loading', (): void => {
  const slug = 'far-reach'
  const playing = 1_027_117_876
  const loading = 1_459_219_193
  expect(armedLine(armedRef(slug), 'playing')).toBe(1e9)
  expect(hardLineIssue('playing', playing, armedRef(slug))).toMatchObject({
    severity: 'warning',
    limit: 1e9,
  })
  expect(
    offlineMemoryAdmission('refuse', 'upload', CATALOGUE).accept({
      ...request(slug, loading),
      playingBytes: playing,
    }),
  ).toBe(true)
})

test('CP10 (J486): three of the four zones once held are armed again, since pins are never re-judged', (): void => {
  for (const slug of ['driftwood-isle', 'nalati-grasslands', 'pine-hollow']) {
    expect(zoneArmed(armedRef(slug)), slug).toBe(true)
    expect(armedLine(armedRef(slug), 'loading'), slug).toBe(ARMED_LINES.loading)
    expect(hardLineIssue('loading', 2e9, armedRef(slug)).severity, slug).toBe(
      'refusal',
    )
  }
})

test('SM4: Nine Dragon is held again; its 1.96 GB offline loading total reports', (): void => {
  const slug = 'nine-dragon-stack'
  expect(zoneArmed(armedRef(slug))).toBe(false)
  expect(hardLineIssue('loading', 1_963_937_967, armedRef(slug))).toMatchObject(
    {
      severity: 'warning',
      limit: ARMED_LINES.loading,
    },
  )
})

test('J445: Brasscap warns above the playing target and refuses above the loading ceiling', (): void => {
  const playing = armedLine(ARMED_REF, 'playing') ?? 0
  const loading = armedLine(ARMED_REF, 'loading') ?? 0
  expect([playing, loading]).toEqual([1e9, 1.5e9])
  const over = hardLineIssue('playing', playing + 1, {
    ...ARMED_REF,
    line: playing,
  })
  expect(over).toMatchObject({ severity: 'warning', limit: 1e9 })
  expect(over.metric).toContain('target, J445')
  expect(
    hardLineIssue('loading', loading + 1, { ...ARMED_REF, line: loading })
      .severity,
  ).toBe('refusal')
  expect(
    ratchetSeverity(ARMED_REF, 'playing', { line: playing, actual: playing }),
  ).toBe('warning')
  // The report-only switch is no way out for an armed zone.
  expect(MEMORY_GATES.reportOnly).toBe(true)
  expect(
    hardLineIssue('loading', MEMORY_HARD_BYTES + 1, ARMED_REF).severity,
  ).toBe('refusal')
})

test('FP27c: a bare slug carries no armed word, so Brasscap alone only reports', (): void => {
  expect(hardLineIssue('loading', MEMORY_HARD_BYTES + 1, ARMED).severity).toBe(
    'warning',
  )
})

test('J424: a zone not armed reports every reading over a line', (): void => {
  expect(armedLine(UNARMED, 'playing')).toBeUndefined()
  const issue = hardLineIssue('loading', 2e9, UNARMED)
  expect(issue.severity).toBe('warning')
  expect(issue.metric).toContain('J424')
  expect(hardLineIssue('loading', 2e9).severity).toBe('warning')
  expect(ratchetLimit(UNARMED, 'loading', MEMORY_HARD_BYTES)).toBe(
    Number.POSITIVE_INFINITY,
  )
})

test('J445: runtime-tier overages report and stale readings retain their validation', (): void => {
  const large = BUDGET_TIERS.large.memoryBytes
  expect(
    ratchetSeverity(ARMED_REF, 'runtime', { line: large, actual: large + 1 }),
  ).toBe('warning')
  expect(
    ratchetSeverity(UNARMED, 'runtime', { line: large, actual: large + 1 }),
  ).toBe('warning')
  expect(stale(ARMED)).toBe('refusal')
  expect(stale(UNARMED)).toBe('warning')
})

test('J426: offline admission refuses an armed zone over the hard line, Developer or not', (): void => {
  const over = MEMORY_HARD_BYTES + 1
  for (const policy of ['warn', 'refuse'] as const) {
    const admission = offlineMemoryAdmission(policy, 'upload', CATALOGUE)
    expect(admission.accept(request(ARMED, over))).toBe(false)
    expect(admission.accept(request(UNARMED, over))).toBe(true)
  }
  const developer = new MemoryAdmission(
    (): boolean => true,
    (owner, kind): number =>
      ratchetLimit(armedZone(owner, CATALOGUE), kind, MEMORY_HARD_BYTES),
  )
  expect(developer.accept(request(ARMED, over))).toBe(false)
})
