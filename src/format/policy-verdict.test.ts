// SHARD-COMPAT CP10 (J486 D1.1): memory and budget policy judges a shard file once, at upload. A stored original, an
// engine pin and a cook validate `judged: 'stored'`: readability is checked, the policy only reports.
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { beforeAll, expect, test } from 'vitest'

import { zoneArmed } from './memory-armed.ts'
import { MEMORY_EPOCH } from './memory-epoch.ts'
import { MEMORY_HARD_BYTES } from './memory-line.ts'
import { offlineMemoryAdmission, prepareAssetDecoders } from './shardfile-assets.ts'
import {
  assertShardfileTargets,
  validateShardfileFolder,
} from './shardfileValidation.ts'

import type { MemoryAdmissionRequest } from './memoryAdmission.ts'
import type { ShardfileFiles } from './shardfileValidation.ts'
import type { Shardfile } from './shardSchema.ts'

const CORPUS = new URL('../../corpus/exports/brasscap-mesa/', import.meta.url)
  .pathname
const ARMED = 'brasscap-mesa'

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function corpus(): ShardfileFiles {
  const files = new Map<string, Uint8Array>()
  for (const entry of readdirSync(CORPUS, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) {
      const absolute = path.join(entry.parentPath, entry.name)
      files.set(
        path.relative(CORPUS, absolute).split(path.sep).join('/'),
        new Uint8Array(readFileSync(absolute)),
      )
    }
  }
  return {
    read: (file: string): Uint8Array => {
      const bytes = files.get(file)
      if (bytes === undefined) {
        throw new Error(`missing ${file}`)
      }
      return bytes
    },
    paths: (): Iterable<string> => files.keys(),
  }
}

function request(loadingBytes: number): MemoryAdmissionRequest {
  return {
    stage: 'declared',
    owner: ARMED,
    id: `${ARMED}:worst`,
    claimedBytes: 1,
    accountedBytes: 1,
    playingBytes: 1,
    loadingBytes,
  }
}

beforeAll(async (): Promise<void> => {
  await prepareAssetDecoders()
})

test('CP10: an upload carries its verdict and rule version; a stored check says it was not re-judged', (): void => {
  expect(zoneArmed(ARMED)).toBe(true)
  const upload = validateShardfileFolder(corpus(), { hash: sha256 })
  expect(upload.policy).toMatchObject({
    judged: 'upload',
    epoch: MEMORY_EPOCH,
    armed: true,
  })
  expect(
    upload.policy.issues.every(
      (issue): boolean => issue.severity === 'warning',
    ),
  ).toBe(true)
  const stored = validateShardfileFolder(corpus(), {
    hash: sha256,
    judged: 'stored',
  })
  expect(stored.policy).toMatchObject({ judged: 'stored', armed: true })
  expect(stored.index).toEqual(upload.index)
})

test('CP10: a stored shard file over an armed line is admitted with the issue reported, an upload is refused', (): void => {
  const { shard } = validateShardfileFolder(corpus(), { hash: sha256 })
  // A reading from memory epoch 1 is stale (MG5): an armed zone's upload refuses it.
  const staleShard = {
    ...shard,
    runtime: {
      ...shard.runtime,
      cost: {
        webContentMB: 400,
        glMB: 50,
        engineBaseMB: 299,
        rev: '151dd6058',
        device: 'fixture',
        evidence: 'progress/memory/fixture.json',
        epoch: 1,
      },
    },
  } as unknown as Shardfile
  expect((): unknown => assertShardfileTargets(staleShard, 'warn')).toThrow(
    /REFUSAL/u,
  )
  const verdict = assertShardfileTargets(
    staleShard,
    'warn',
    new Map(),
    'stored',
  )
  expect(verdict.judged).toBe('stored')
  expect(
    verdict.issues.some((issue): boolean => issue.severity === 'refusal'),
  ).toBe(true)
})

test('CP10: offline admission never refuses a stored shard file over the hard line', (): void => {
  const over = MEMORY_HARD_BYTES + 1
  expect(offlineMemoryAdmission('refuse').accept(request(over))).toBe(false)
  expect(
    offlineMemoryAdmission('refuse', 'stored').accept(request(over)),
  ).toBe(true)
})
