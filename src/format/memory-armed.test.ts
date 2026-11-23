// J426 (Jake, 2026-11-18): "get the shard passing the memory gate and then to LOCK THE GATE IN. And make it fail hard /
// mandatory." On J424: only a zone in the armed list (`memory-armed.json`) refuses; every other zone reports.
import { expect, test } from 'vitest'

import { BUDGET_TIERS } from './budget-tiers.ts'
import { MEMORY_GATES } from './contentBounds.ts'
import {
  ARMED_LINES,
  ARMED_ZONES,
  armedLine,
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
  })[0]?.severity
}

test('J426: the list arms Brasscap at the J410 lines', (): void => {
  expect(ARMED_LINES).toEqual({ playing: 1e9, loading: 1.5e9 })
  expect(zoneArmed(ARMED)).toBe(true)
  expect(zoneArmed(UNARMED)).toBe(false)
  expect([zoneArmed(), zoneArmed('toString')]).toEqual([false, false])
})

test('J445: armed zones use the common lines for a new shard revision', (): void => {
  for (const [slug, zone] of Object.entries(ARMED_ZONES)) {
    expect(armedLine(slug, 'playing'), slug).toBe(ARMED_LINES.playing)
    expect(armedLine(slug, 'loading'), slug).toBe(ARMED_LINES.loading)
    expect(zone.loadingBytes, slug).toBeLessThanOrEqual(ARMED_LINES.loading)
    expect(zone.evidence.length, slug).toBeGreaterThan(0)
    expect(zone.armed, slug).toMatch(/^\d{4}-\d{2}-\d{2}$/u)
  }
})

test('J445: Far Reach at 1,027 MB playing reports and admits under 1.5 GB loading', (): void => {
  const slug = 'far-reach'
  const playing = 1_027_117_876
  const loading = 1_459_219_193
  expect(armedLine(slug, 'playing')).toBe(1e9)
  expect(hardLineIssue('playing', playing, slug)).toMatchObject({
    severity: 'warning',
    limit: 1e9,
  })
  expect(
    offlineMemoryAdmission('refuse').accept({
      ...request(slug, loading),
      playingBytes: playing,
    }),
  ).toBe(true)
})

test('CP10 (J486): three of the four zones once held are armed again, since pins are never re-judged', (): void => {
  for (const slug of ['driftwood-isle', 'nalati-grasslands', 'pine-hollow']) {
    expect(zoneArmed(slug), slug).toBe(true)
    expect(armedLine(slug, 'loading'), slug).toBe(ARMED_LINES.loading)
    expect(hardLineIssue('loading', 2e9, slug).severity, slug).toBe('refusal')
    expect(ARMED_ZONES[slug]?.loadingBytes, slug).toBeLessThanOrEqual(
      ARMED_LINES.loading,
    )
  }
})

test('SM4: Nine Dragon is held again; its 1.96 GB offline loading total reports', (): void => {
  const slug = 'nine-dragon-stack'
  expect(zoneArmed(slug)).toBe(false)
  expect(hardLineIssue('loading', 1_963_937_967, slug)).toMatchObject({
    severity: 'warning',
    limit: ARMED_LINES.loading,
  })
})

test('J445: Brasscap warns above the playing target and refuses above the loading ceiling', (): void => {
  const playing = armedLine(ARMED, 'playing') ?? 0
  const loading = armedLine(ARMED, 'loading') ?? 0
  expect([playing, loading]).toEqual([1e9, 1.5e9])
  const over = hardLineIssue('playing', playing + 1, {
    slug: ARMED,
    line: playing,
  })
  expect(over).toMatchObject({ severity: 'warning', limit: 1e9 })
  expect(over.metric).toContain('target, J445')
  expect(
    hardLineIssue('loading', loading + 1, { slug: ARMED, line: loading })
      .severity,
  ).toBe('refusal')
  expect(
    ratchetSeverity(ARMED, 'playing', { line: playing, actual: playing }),
  ).toBe('warning')
  // The report-only switch is no way out for an armed zone.
  expect(MEMORY_GATES.reportOnly).toBe(true)
  expect(hardLineIssue('loading', MEMORY_HARD_BYTES + 1, ARMED).severity).toBe(
    'refusal',
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
    ratchetSeverity(ARMED, 'runtime', { line: large, actual: large + 1 }),
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
    const admission = offlineMemoryAdmission(policy)
    expect(admission.accept(request(ARMED, over))).toBe(false)
    expect(admission.accept(request(UNARMED, over))).toBe(true)
  }
  const developer = new MemoryAdmission(
    (): boolean => true,
    (owner, kind): number => ratchetLimit(owner, kind, MEMORY_HARD_BYTES),
  )
  expect(developer.accept(request(ARMED, over))).toBe(false)
})
