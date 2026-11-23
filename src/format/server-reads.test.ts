import { expect, test } from 'vitest'

import { serverReadsFile } from './server-reads.ts'

test('the server reads bin, json and wasm files and the terrain tile, nothing else (PR6d)', (): void => {
  const hash = 'a'.repeat(64)
  expect(
    ['bin', 'json', 'wasm'].map((kind): boolean =>
      serverReadsFile({ kind, hash }),
    ),
  ).toEqual([true, true, true])
  expect(
    ['glb', 'ktx2', 'audio', 'image'].map((kind): boolean =>
      serverReadsFile({ kind, hash }),
    ),
  ).toEqual([false, false, false, false])
  expect(serverReadsFile({ kind: 'tile', hash }, `blobs/tile/${hash}`)).toBe(
    true,
  )
  expect(serverReadsFile({ kind: 'tile', hash }, 'blobs/tile/other')).toBe(
    false,
  )
  expect(serverReadsFile({ kind: 'tile', hash })).toBe(false)
})
