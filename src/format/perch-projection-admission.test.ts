import { readFileSync } from 'node:fs'

import { parse } from 'valibot'
import { expect, test } from 'vitest'

import {
  admissionFixture,
  digest,
  fixtureBudget,
  jsonFixture,
} from '../test/helpers/perch-assets.ts'
import { validateShardfileAssets } from './assetAdmission.ts'
import { creaturePerchAdmissionRows } from './creature-perch.ts'
import { ReturnProgramWireDocumentSchema } from './returnProgramDocument.ts'
import { assetCost } from './shardfile-assets.ts'
import { parseShardfile } from './shardSchema.ts'

import type { ReturnProgramDocumentInput } from './returnProgramDocument.ts'
import type { Shardfile } from './shardSchema.ts'

function projectionAsset(): {
  program: ReturnProgramDocumentInput
  file: Shardfile['files'][number]
  bytes: Uint8Array
} {
  const program = parse(
    ReturnProgramWireDocumentSchema,
    jsonFixture('perch-projection'),
  )
  const artifact = program.v2?.artifact
  if (artifact === undefined) {
    throw new Error('Missing native ABI-2 fixture')
  }
  const bytes = readFileSync(
    new URL('fixtures/perch-projection.wasm', import.meta.url),
  )
  const file: Shardfile['files'][number] = {
    hash: artifact.hash,
    kind: 'wasm',
    compressed: bytes.length,
    dependencies: [],
    critical: true,
    ...assetCost('wasm', bytes, {
      abi: 2,
      lane: artifact.lane,
      pages: artifact.pages,
      ioBytes: artifact.ioBytes,
      compilerRevision: artifact.compilerRevision,
      admissionRevision: artifact.admissionRevision,
    }),
  }
  return { program, file, bytes }
}

test('actual ABI-2 projection admission counts the runtime artifact once, without its ABI-1 witness', (): void => {
  const { shard } = admissionFixture(),
    { program, file, bytes } = projectionAsset()
  const body = shard.creatures.perchBodies?.[0]
  if (body === undefined) {
    throw new Error('Missing fixture body')
  }
  const candidate = parseShardfile({
    ...shard,
    files: [file],
    critical: [file.hash],
    ...fixtureBudget([file]),
    creatures: { ...shard.creatures, perchBodies: [{ ...body, program }] },
  })
  const rows = creaturePerchAdmissionRows(candidate.creatures.perchBodies ?? [])
  expect(rows).toHaveLength(1)
  expect(rows[0]?.module).toBe(`blobs/wasm/${file.hash}.wasm`)
  expect(rows[0]?.module).not.toBe(program.script.module)
  expect((): void => {
    validateShardfileAssets(candidate, new Map([[file.hash, bytes]]), digest)
  }).not.toThrow()
})
