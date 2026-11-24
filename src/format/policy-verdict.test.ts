// oxlint-disable typescript/prefer-readonly-parameter-types, typescript/no-unsafe-type-assertion, import/max-dependencies -- a test over the corpus export, with one hand-staled reading
// SHARD-COMPAT CP10 (J486 D1.1): memory and budget policy judges a shard file once, at upload. A stored original, an
// engine pin and a cook validate `judged: 'stored'`: readability is checked, the policy only reports.
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { beforeAll, expect, test } from 'vitest'

import { zoneArmed } from './memory-armed.ts'
import { MEMORY_EPOCH } from './memory-epoch.ts'
import { MEMORY_HARD_BYTES } from './memory-line.ts'
import { asJudged } from './policy-verdict.ts'
import {
  offlineMemoryAdmission,
  prepareAssetDecoders,
} from './shardfile-assets.ts'
import {
  assertShardfileTargets,
  validateShardfileFolder,
} from './shardfileValidation.ts'

import type { MemoryAdmissionRequest } from './memoryAdmission.ts'
import type { ShardfileFiles } from './shardfileValidation.ts'
import type { Shardfile } from './shardSchema.ts'

// ZONE-SNAPSHOTS ZS5 (J507): a whole made-up folder, never a stored zone.
const CORPUS = new URL('../test/fixtures/cli-fixture/', import.meta.url)
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
  // FP27c: the catalogue's armed word, which admission passes; a bare slug is not armed.
  expect(zoneArmed(ARMED)).toBe(false)
  const upload = validateShardfileFolder(corpus(), {
    hash: sha256,
    armed: true,
  })
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
    armed: true,
  })
  expect(stored.policy).toMatchObject({ judged: 'stored', armed: true })
  expect(stored.index).toEqual(upload.index)
})

test('CP10: a stored shard file over an armed line is admitted with the issue reported, an upload is refused', (): void => {
  const { shard } = validateShardfileFolder(corpus(), {
    hash: sha256,
    armed: true,
  })
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
  const armed = { sections: new Map(), mountedImages: 0, armed: true }
  expect((): unknown =>
    assertShardfileTargets(staleShard, 'warn', armed),
  ).toThrow(/REFUSAL/u)
  const verdict = assertShardfileTargets(staleShard, 'warn', {
    ...armed,
    judged: 'stored',
  })
  expect(verdict.judged).toBe('stored')
  expect(
    verdict.issues.some((issue): boolean => issue.severity === 'refusal'),
  ).toBe(true)
})

test('CP10: offline admission never refuses a stored shard file over the hard line', (): void => {
  const over = MEMORY_HARD_BYTES + 1
  expect(
    offlineMemoryAdmission('refuse', 'upload', true).accept(request(over)),
  ).toBe(false)
  expect(
    offlineMemoryAdmission('refuse', 'stored', true).accept(request(over)),
  ).toBe(true)
})

test('CP10: a stored original: its file facts only warn in the cook; measured script costs still refuse', (): void => {
  const issues = [
    { code: 'perf-loading-memory', severity: 'refusal' as const },
    { code: 'perf-script-cpu', severity: 'refusal' as const },
  ]
  expect(
    asJudged(issues, 'stored').map(({ severity }): string => severity),
  ).toEqual(['warning', 'refusal'])
  expect(asJudged(issues, 'upload')).toEqual(issues)
})
