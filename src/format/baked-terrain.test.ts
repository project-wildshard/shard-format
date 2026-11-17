/* oxlint-disable curly, id-length, no-bitwise, typescript/explicit-function-return-type, typescript/no-unsafe-type-assertion, typescript/prefer-readonly-parameter-types, unicorn/no-array-callback-reference -- golden-vector oracle and fixtures (SDK-SPLIT SP4): written to match the engine side byte for byte */
// SDK-SPLIT SP4c (Q35): the baked-terrain reader and samplers are format laws the engine already re-exports
// (engine world/BakedTerrain.ts), so the sdk's bake reads them from here. baked-terrain.golden.json was sampled through
// the engine's exports over fixture grids; this pins the format functions to it bit for bit.
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { fixtureBakedBytes } from './baked-terrain.golden-specs.ts'
import { parseBakedTerrain } from './bakedTerrainBytes.ts'
import { bakedSamplers } from './bakedTerrainSampling.ts'
import { TERRAIN_POINTS, TERRAIN_SPECS } from './terrain-field.golden-specs.ts'

type Sample = [string, string[], string[]]
interface Golden {
  readonly grids: readonly {
    readonly name: string
    readonly res: number
    readonly size: number
    readonly seed: number
    readonly samples: readonly Sample[]
  }[]
  readonly refused: readonly boolean[]
}
const golden = JSON.parse(
  readFileSync(new URL('baked-terrain.golden.json', import.meta.url), 'utf8'),
) as Golden

function bits(value: number): string {
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, value)
  return view.getBigUint64(0).toString(16).padStart(16, '0')
}

describe('baked terrain matches the engine bit for bit', () => {
  for (const [index, entry] of TERRAIN_SPECS.entries()) {
    it(`${entry.name}: header and height, normal and splat samples`, () => {
      const want = golden.grids[index]
      const grid = parseBakedTerrain(fixtureBakedBytes(index), {
        res: 33,
        seed: entry.seed >>> 0,
      })
      expect(grid).not.toBeNull()
      if (grid === null) return
      expect([grid.res, grid.size, grid.seed]).toEqual([
        want?.res,
        want?.size,
        want?.seed,
      ])
      const samplers = bakedSamplers(grid)
      expect(
        TERRAIN_POINTS.map(([x, z]): Sample => [
          bits(samplers.heightAt(x, z)),
          samplers.normalAt(x, z).map(bits),
          samplers.splatAt(x, z).map(bits),
        ]),
      ).toEqual(want?.samples)
    })
  }
  it('refuses short bytes and a wrong res or seed, as the engine does', () => {
    expect(
      [
        parseBakedTerrain(new Uint8Array(10)),
        parseBakedTerrain(fixtureBakedBytes(0), { res: 32 }),
        parseBakedTerrain(fixtureBakedBytes(0), { seed: 1 }),
      ].map(grid => grid === null),
    ).toEqual(golden.refused)
  })
})
