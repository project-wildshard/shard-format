/* oxlint-disable id-length, import/no-namespace, typescript/explicit-function-return-type, typescript/no-unsafe-type-assertion -- golden-vector oracle and fixtures (SDK-SPLIT SP4): written to match the engine side byte for byte */
// SDK-SPLIT SP4e (Q35): the stored geometry layouts are format laws. geometry-layout.golden.json was answered by the
// engine's own NativeAttributesSchema and readWholePartition (geometry-layout.golden-gen.mjs) over
// geometry-layout.golden-specs.ts, so this proves format's copies admit, expand and refuse the same inputs.
import { readFileSync } from 'node:fs'

import * as v from 'valibot'
import { describe, expect, it } from 'vitest'

import {
  CHANNEL_CASES,
  PARTITION_CASES,
  channelAnswer,
  partitionAnswer,
} from './geometry-layout.golden-specs.ts'
import { NativeAttributesSchema } from './native-geometry-channels.ts'
import { readWholePartition } from './whole-partition.ts'

interface Golden {
  readonly channels: readonly unknown[]
  readonly partitions: readonly unknown[]
}
const golden = JSON.parse(
  readFileSync(new URL('geometry-layout.golden.json', import.meta.url), 'utf8'),
) as Golden

describe('geometry layouts match the engine', () => {
  it('admits and refuses the same native channel tables', () => {
    expect(
      CHANNEL_CASES.map(input =>
        channelAnswer(value => v.parse(NativeAttributesSchema, value), input),
      ),
    ).toEqual(golden.channels)
  })
  it('admits, expands and refuses the same whole-piece run lists', () => {
    expect(
      PARTITION_CASES.map(input => partitionAnswer(readWholePartition, input)),
    ).toEqual(golden.partitions)
  })
})
