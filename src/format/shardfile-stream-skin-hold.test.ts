import { expect, test } from 'vitest'

import { placedPaths } from './shardfile-stream-assets.ts'

import type { AssetAdmission } from './assetAdmission.ts'
import type { KeptMember } from './shardfile-stream-rows.ts'

// ONE-FORMAT OF30: Nalati r7 (OF30's declared skin looks) was refused `stream-cap` because the later read held each
// skin file's whole dependency closure, its textures included, though no check after the files reads a texture's bytes.
// A skin look whose closure is over the 48 MILLION hold cap, nearly all of it textures, now holds only its JSON and GLB.

const MILLION = 1_000_000
const hex = (at: number): string => at.toString(16).padStart(64, '0')
const SKIN = hex(1)
const GLB = hex(2)
const TEXTURES = [hex(3), hex(4), hex(5)]
const SIZES: readonly (readonly [string, number])[] = [
  [SKIN, 20_000],
  [GLB, 3 * MILLION],
  ...TEXTURES.map((hash: string): readonly [string, number] => [
    hash,
    20 * MILLION,
  ]),
]
const file = (
  hash: string,
  kind: string,
  dependencies: readonly string[] = [],
): unknown => ({ hash, kind, dependencies })

function admission(): AssetAdmission {
  const shard = {
    audio: { recordings: {} },
    rows: {
      looks: [
        {
          id: 'roc',
          species: 'roc',
          recipe: 'platform.skin',
          parameters: { skin: SKIN },
        },
      ],
      compendiums: [],
    },
    entryways: [],
    requires: { commons: [] },
    files: [
      file(SKIN, 'json', [GLB, ...TEXTURES]),
      file(GLB, 'glb'),
      ...TEXTURES.map((hash: string): unknown => file(hash, 'ktx2')),
    ],
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- placedPaths reads only the shard's placed roots and files
  return { shard } as unknown as AssetAdmission
}

test('a skin look whose closure is over the hold cap holds only its JSON and GLB', (): void => {
  const paths = new Map(
    SIZES.map(([hash]: readonly [string, number]): [string, string] => [
      hash,
      `blobs/${hash}`,
    ]),
  )
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- placedPaths reads only each member's size and bytes
  const members = new Map(
    SIZES.map(([hash, size]: readonly [string, number]): [string, unknown] => [
      `blobs/${hash}`,
      { sha: hash, size, bytes: undefined },
    ]),
  ) as unknown as ReadonlyMap<string, KeptMember>
  const closure = SIZES.reduce(
    (total: number, [, size]: readonly [string, number]): number =>
      total + size,
    0,
  )
  expect(closure).toBeGreaterThan(48 * MILLION)
  const keep = placedPaths(
    { members, keptBytes: 13 * MILLION },
    admission(),
    paths,
  )
  expect(keep).toEqual(new Set([`blobs/${SKIN}`, `blobs/${GLB}`]))
})
