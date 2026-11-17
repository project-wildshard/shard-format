/* oxlint-disable id-length, import/newline-after-import, import/no-namespace, import/no-nodejs-modules, no-magic-numbers, node/no-sync, typescript/no-unsafe-argument, typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, unicorn/import-style -- golden-vector oracle and fixtures (SDK-SPLIT SP4): written to match the engine side byte for byte */
// Golden vectors for SDK-SPLIT SP4e (layouts), from the ENGINE's NativeAttributesSchema and readWholePartition (the oracle).
// Usage: node --import <engine>/scripts/sim-node-loader.mjs src/format/geometry-layout.golden-gen.mjs <engine src> <out.json>
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import * as v from 'valibot'

import {
  CHANNEL_CASES,
  PARTITION_CASES,
  channelAnswer,
  partitionAnswer,
} from './geometry-layout.golden-specs.ts'
const { NativeAttributesSchema } = await import(
  join(process.argv[2], 'client/engine/models/nativeGeometry.ts')
)
const { readWholePartition } = await import(
  join(process.argv[2], 'client/game/shardfile/wholeGeometryPieces.ts')
)
writeFileSync(
  process.argv[3],
  `${JSON.stringify({
    about:
      'SDK-SPLIT SP4e: engine models/nativeGeometry.ts NativeAttributesSchema and game/shardfile/wholeGeometryPieces.ts readWholePartition over geometry-layout.golden-specs.ts',
    channels: CHANNEL_CASES.map(input =>
      channelAnswer(value => v.parse(NativeAttributesSchema, value), input),
    ),
    partitions: PARTITION_CASES.map(input =>
      partitionAnswer(readWholePartition, input),
    ),
  })}\n`,
)
