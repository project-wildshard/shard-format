/* oxlint-disable typescript/no-unsafe-type-assertion -- PR6e fixture: a partial props section */
import { expect, test } from 'vitest'

import { wholeGeometryInputs } from './whole-inputs.ts'

import type { Shardfile } from './shardSchema.ts'

test('whole intake reads the L0 tiles and their extra files, and the whole library only when asked (PR6e)', (): void => {
  const props = {
    tiles: [
      { lod: 0, file: 'a', additionalFiles: ['b'] },
      { lod: 1, file: 'c' },
      { lod: 0, file: 'd' },
    ],
    wholeLibrary: ['e'],
  } as unknown as Shardfile['props']
  expect(wholeGeometryInputs(props, false)).toEqual(['a', 'b', 'd'])
  expect(wholeGeometryInputs(props, true)).toEqual(['a', 'b', 'd', 'e'])
})
