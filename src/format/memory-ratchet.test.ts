// J411 / J412: memory gates are ratchets. A zone refuses only when worse than its baseline; within it, the gate reports.
import { expect, test } from 'vitest'

import { BUDGET_TIERS } from './budget-tiers.ts'
import { staleRuntimeIssues } from './memory-epoch.ts'
import { hardLineIssue, MEMORY_HARD_BYTES } from './memory-line.ts'
import {
  MEMORY_RATCHET,
  RATCHET_ALLOWANCE,
  ratchetLimit,
  ratchetSeverity,
} from './memory-ratchet.ts'
import { MemoryAdmission } from './memoryAdmission.ts'
import { runtimeTierIssues } from './runtime-tier.ts'

import type { MemoryAdmissionRequest } from './memoryAdmission.ts'

const nineLoading = MEMORY_RATCHET['nine-dragon-stack']?.loading ?? 0
const overBaseline =
  nineLoading + Math.floor(nineLoading * RATCHET_ALLOWANCE) + 1
const overLine = MEMORY_HARD_BYTES + 1

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

function hardLine(owner: string, kind: 'playing' | 'loading'): number {
  return ratchetLimit(owner, kind, MEMORY_HARD_BYTES)
}

function staleSeverity(slug: string, revision: number): string | undefined {
  return staleRuntimeIssues({ cost: { epoch: 1 } }, undefined, {
    slug,
    revision,
  })[0]?.severity
}

test('J412: a zone with no baseline keeps the refusing line', (): void => {
  expect(ratchetLimit('sunscar-dunes', 'loading', MEMORY_HARD_BYTES)).toBe(
    MEMORY_HARD_BYTES,
  )
  expect(ratchetLimit(undefined, 'loading', MEMORY_HARD_BYTES)).toBe(
    MEMORY_HARD_BYTES,
  )
  expect(hardLineIssue('loading', overLine, 'sunscar-dunes').severity).toBe(
    'refusal',
  )
  expect(hardLineIssue('loading', overLine).severity).toBe('refusal')
})

test('J412: within its baseline a zone over the line reports; worse than its baseline it refuses', (): void => {
  const within = hardLineIssue('loading', nineLoading, 'nine-dragon-stack')
  expect(within.severity).toBe('warning')
  expect(within.metric).toContain('J412 ratchet')
  expect(
    hardLineIssue('loading', overBaseline, 'nine-dragon-stack').severity,
  ).toBe('refusal')
  // A field the row leaves out keeps the line: Driftwood has no playing baseline.
  expect(
    ratchetSeverity('driftwood-isle', 'playing', {
      line: MEMORY_HARD_BYTES,
      actual: overLine,
    }),
  ).toBe('refusal')
})

test('J412: the runtime tier ratchets per zone', (): void => {
  const large = BUDGET_TIERS.large.memoryBytes
  const runtime = MEMORY_RATCHET['nalati-grasslands']?.runtime ?? 0
  const worse = runtime + Math.ceil(runtime * RATCHET_ALLOWANCE * 2)
  expect(
    ratchetSeverity('nalati-grasslands', 'runtime', {
      line: large,
      actual: runtime,
    }),
  ).toBe('warning')
  expect(
    ratchetSeverity('nalati-grasslands', 'runtime', {
      line: large,
      actual: worse,
    }),
  ).toBe('refusal')
  expect(
    ratchetSeverity('far-reach', 'runtime', { line: large, actual: large + 1 }),
  ).toBe('refusal')
  const cost = {
    webContentMB: 900,
    glMB: 300,
    engineBaseMB: 299,
    rev: '5357804745121cdda8f9492b62d3266244f4ac1b',
    device: 'd',
    evidence: 'progress/memory/test.json',
    epoch: 3,
  }
  expect(
    runtimeTierIssues({ runtime: { cost }, budgets: {} })[0]?.severity,
  ).toBe('refusal')
})

test('J412: only the pinned revision keeps its stale reading', (): void => {
  expect(staleSeverity('nine-dragon-stack', 1)).toBe('warning')
  expect(staleSeverity('nine-dragon-stack', 2)).toBe('refusal')
  expect(staleSeverity('sunscar-dunes', 1)).toBe('refusal')
  expect(staleRuntimeIssues({ cost: { epoch: 1 } })[0]?.severity).toBe(
    'refusal',
  )
})

test('J412: offline admission holds each owner at its own line', (): void => {
  const admission = new MemoryAdmission((): boolean => true, hardLine)
  expect(admission.accept(request('nine-dragon-stack', nineLoading))).toBe(true)
  expect(admission.accept(request('nine-dragon-stack', overBaseline))).toBe(
    false,
  )
  expect(admission.accept(request('sunscar-dunes', overLine))).toBe(false)
})
