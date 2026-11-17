/* oxlint-disable max-lines-per-function, id-length, typescript/explicit-function-return-type, typescript/no-unsafe-type-assertion, typescript/prefer-readonly-parameter-types, unicorn/no-array-callback-reference -- golden-vector oracle and fixtures (SDK-SPLIT SP4): written to match the engine side byte for byte */
// SDK-SPLIT SP4b (Q35): the terrain field is a format law. terrain-field.golden.json was sampled from the engine's own
// buildTerrain and Noise2D (terrain-field.golden-gen.mjs) over terrain-field.golden-specs.ts, so this proves the
// format copy builds the same field bit for bit.
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { Noise2D, clamp, lerp, smoothstep } from './noise.ts'
import { TERRAIN_POINTS, TERRAIN_SPECS } from './terrain-field.golden-specs.ts'
import {
  buildTerrain,
  buildTerrainMetadata,
  landscapeHash,
} from './terrain-field.ts'

type Sample = [string, string[], string[], string, string, string, string]
interface Golden {
  readonly fields: readonly {
    readonly name: string
    readonly seed: number
    readonly landscapeHash: number
    readonly waterLevel: string
    readonly samples: readonly Sample[]
  }[]
  readonly noise: readonly {
    readonly seed: number
    readonly samples: readonly [string, string, string][]
  }[]
  readonly helpers: readonly [string, string, string][]
}
const golden = JSON.parse(
  readFileSync(new URL('terrain-field.golden.json', import.meta.url), 'utf8'),
) as Golden

/** IEEE-754 float64 bits, big-endian hex: the comparison is bit-exact, not approximate. */
function bits(value: number): string {
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, value)
  return view.getBigUint64(0).toString(16).padStart(16, '0')
}

describe('terrainField matches the engine bit for bit', () => {
  it('covers every fixture spec', () => {
    expect(golden.fields.map(field => field.name)).toEqual(
      TERRAIN_SPECS.map(entry => entry.name),
    )
  })
  for (const [index, { name, seed, spec }] of TERRAIN_SPECS.entries()) {
    it(`${name}: height, normal, splat, trails, pads, pond and water`, () => {
      const want = golden.fields[index]
      const field = buildTerrain(seed, spec)
      const meta = buildTerrainMetadata(seed, spec, field.waterLevel)
      expect(landscapeHash(field)).toBe(want?.landscapeHash)
      expect(bits(field.waterLevel())).toBe(want?.waterLevel)
      const got = TERRAIN_POINTS.map(([x, z]): Sample => [
        bits(field.heightAt(x, z)),
        field.normalAt(x, z).map(bits),
        field.splatAt(x, z).map(bits),
        bits(field.trailDistance(x, z)),
        bits(field.cabinMask(x, z)),
        bits(field.pondMask(x, z)),
        bits(meta.pondMask(x, z)),
      ])
      expect(got).toEqual(want?.samples)
    })
  }
  it('Noise2D samples get, fbm and ridged as the engine does', () => {
    for (const { seed, samples } of golden.noise) {
      const noise = new Noise2D(seed)
      expect(
        TERRAIN_POINTS.slice(0, 30).map(([x, z]) => [
          bits(noise.get(x * 0.013, z * 0.017)),
          bits(noise.fbm(x * 0.004, z * 0.004)),
          bits(noise.ridged(x * 0.01, z * 0.01)),
        ]),
      ).toEqual(samples)
    }
  })
  it('smoothstep, clamp and lerp agree', () => {
    expect(
      [
        [0, 1, 0.3],
        [2, 5, 4.9],
        [-1, 1, -3],
      ].map(([a = 0, b = 0, x = 0]) => [
        bits(smoothstep(a, b, x)),
        bits(clamp(x, a, b)),
        bits(lerp(a, b, x)),
      ]),
    ).toEqual(golden.helpers)
  })
})
