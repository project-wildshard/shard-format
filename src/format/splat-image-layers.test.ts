import { parse } from 'valibot'
// SF16 (J525): a shardfile carries images only, so a splat ground's layers may be PNG or JPEG image blobs the cook encodes
// to their unflipped `#layer` KTX2 twins. Any other kind, or a layer no declared tile depends on, still refuses.
import { expect, test } from 'vitest'

import { SplatTerrainSchema, validateSplatTerrain } from './splatTerrain.ts'

type Context = Parameters<typeof validateSplatTerrain>[1]

const HASH_WIDTH = 64
const hash = (at: number): string => String(at).padStart(HASH_WIDTH, '0')
const TILE = hash(99)
const arm = [9, 10, 11, 12].map((at): string => hash(at))
const colour = [1, 2, 3, 4].map((at): string => hash(at))
const normal = [5, 6, 7, 8].map((at): string => hash(at))
const layers = [...colour, ...normal, ...arm]
const white: [number, number, number] = [1, 1, 1]
const splat = parse(SplatTerrainSchema, {
  // oxlint-disable-next-line unicorn/no-null -- the schema's own value for the plain splat shader
  boreal: null,
  layers: { arm, colour, normal },
  material: 'splat',
  tints: [white, white, white, white],
})

/** The admitted files: one tile depending on `deps`, and the twelve layers, layer `at` of `kind(at)`. */
function context(
  kind: (at: number) => string,
  deps: readonly string[] = layers,
): Context {
  return {
    files: [
      { dependencies: deps, hash: TILE, kind: 'glb' },
      ...layers.map((layer, at): Context['files'][number] => ({
        dependencies: [],
        hash: layer,
        kind: kind(at),
      })),
    ],
    look: {},
    propTextures: [],
    tiles: [TILE],
  }
}
const check =
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the made-up context, only read
  (files: Context): (() => void) =>
    (): void => {
      validateSplatTerrain(splat, files)
    }

test('admits PNG and JPEG image layers beside KTX2 ones', (): void => {
  expect(check(context((): string => 'image'))).not.toThrow()
  expect(
    check(context((at): string => (at % 2 === 0 ? 'image' : 'ktx2'))),
  ).not.toThrow()
})

test('still refuses a layer of another kind or one no declared tile depends on', (): void => {
  expect(check(context((at): string => (at === 0 ? 'json' : 'image')))).toThrow(
    /KTX2 or image dependency/u,
  )
  const undeclared = layers.slice(1)
  expect(check(context((): string => 'image', undeclared))).toThrow(
    /KTX2 or image dependency/u,
  )
})
