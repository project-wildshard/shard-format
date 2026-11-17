// oxlint-disable typescript/prefer-readonly-parameter-types -- test fixtures edit their own copies
// MEMORY-GATES MG4 (J408, Jake 2026-11-17): a worst playing estimate over 1.5 GB refuses in every offline gate,
// whatever the policy or memoryGates.json's report-only switch. Under the line nothing changes.
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { beforeAll, expect, test } from 'vitest'

import { MEMORY_GATES } from './contentBounds.ts'
import { MEMORY_HARD_BYTES, overHardLine } from './memory-line.ts'
import { MemoryAdmission } from './memoryAdmission.ts'
import {
  offlineMemoryAdmission,
  performanceReport,
  prepareAssetDecoders,
} from './shardfile-assets.ts'
import { validateShardfileFolder } from './shardfileValidation.ts'

import type { MemoryAdmissionRequest } from './memoryAdmission.ts'
import type { Shardfile } from './shardSchema.ts'

beforeAll(async (): Promise<void> => {
  await prepareAssetDecoders()
})

const CORPUS = new URL('../../corpus/handwritten/', import.meta.url).pathname
const unmeasured = {
  scripts: { p95Micros: 0, maxMicros: 0, samples: 0 },
  fuel: { p95: 0, max: 0, samples: 0 },
}

function corpus(): Shardfile {
  const files = new Map<string, Uint8Array>()
  for (const entry of readdirSync(CORPUS, {
    recursive: true,
    withFileTypes: true,
  }).filter((row): boolean => !row.isDirectory())) {
    const absolute = path.join(entry.parentPath, entry.name)
    files.set(
      path.relative(CORPUS, absolute).split(path.sep).join('/'),
      new Uint8Array(readFileSync(absolute)),
    )
  }
  const read = (file: string): Uint8Array => {
    const bytes = files.get(file)
    if (bytes === undefined) {
      throw new Error(`ENOENT: ${file}`)
    }
    return bytes
  }
  return validateShardfileFolder(
    { read, paths: (): string[] => [...files.keys()] },
    {
      hash: (bytes: Uint8Array): string =>
        createHash('sha256').update(bytes).digest('hex'),
    },
  ).shard
}

/** The corpus shard with its sim's resident budget raised so the worst estimate lands at about `playing`. */
function heavy(shard: Shardfile, playing: number): Shardfile {
  const base = performanceReport(shard, unmeasured, 'warn').memory.worst.playing
  const sim = shard.budgets.sim.resident + Math.ceil((playing - base) / 1.11)
  return {
    ...shard,
    budgets: { ...shard.budgets, sim: { ...shard.budgets.sim, resident: sim } },
  }
}

const request = (playingBytes: number): MemoryAdmissionRequest => ({
  stage: 'actual',
  owner: 'nine',
  id: 'nine:worst',
  claimedBytes: 1,
  accountedBytes: 1,
  playingBytes,
  loadingBytes: playingBytes,
})

test('MG4: the hard line is engine MEMORY_AMBER, 1.5 GB', (): void => {
  expect(MEMORY_HARD_BYTES).toBe(1.5e9)
  expect(overHardLine(1.4e9)).toBe('')
  expect(overHardLine(1.699e9)).toContain('over the 1.5 GB phone line, J408')
})

test.each(['warn', 'refuse'] as const)(
  'MG4: an over-line worst estimate refuses under %s, report-only or not',
  (policy): void => {
    const over = performanceReport(heavy(corpus(), 1.7e9), unmeasured, policy)
    expect(over.memory.worst.playing).toBeGreaterThan(MEMORY_HARD_BYTES)
    expect(
      over.issues.find(
        (issue): boolean => issue.code === 'perf-playing-memory',
      ),
    ).toMatchObject({ severity: 'refusal', limit: MEMORY_HARD_BYTES })
    expect(over.pass).toBe(false)
  },
)

test.runIf(MEMORY_GATES.reportOnly)(
  'MG4: under the line a report-only estimate still only warns',
  (): void => {
    const shard = corpus()
    const under = performanceReport(heavy(shard, 1.3e9), unmeasured, 'warn')
    expect(under.memory.worst.playing).toBeLessThan(MEMORY_HARD_BYTES)
    expect(
      under.issues.find(
        (issue): boolean => issue.code === 'perf-playing-memory',
      )?.severity,
    ).toBe('warning')
  },
)

test('MG4: the offline admission accepts over the 1.2 GB cap but refuses over the hard line, Developer or not', (): void => {
  const offline = offlineMemoryAdmission('warn')
  expect(offline?.accept(request(1.3e9))).toBe(true)
  expect(offline?.accept(request(1.6e9))).toBe(false)
  expect(
    new MemoryAdmission((): boolean => true, MEMORY_HARD_BYTES).accept(
      request(1.6e9),
    ),
  ).toBe(false)
  expect(new MemoryAdmission((): boolean => true).accept(request(1.6e9))).toBe(
    true,
  )
})
