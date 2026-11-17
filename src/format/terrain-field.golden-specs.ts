/* oxlint-disable id-length, import/exports-last, import/group-exports, max-params, no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/number-literal-case, unicorn/numeric-separators-style -- golden-vector oracle and fixtures (SDK-SPLIT SP4): written to match the engine side byte for byte */
// SDK-SPLIT SP4b: terrain specs whose fields the golden vectors sample. Plain functions over the noise they are
// handed, so the engine's buildTerrain (the oracle, terrain-field.golden-gen.mjs); not shipped and format's build the same field.
// Together they touch every branch: landscape noise, a graded path and a bench, trails, cabin pads, a pond, an ocean,
// a finish and a splat rule.
import type { TerrainSpec } from './terrain-field.ts'

/** A smooth periodic wave in [-1, 1] (period 1) from arithmetic and `Math.floor` only, where a fixture would reach for
 *  `Math.sin`: a host's libm sin and cos can differ in the last bit (macOS arm64 against Linux x64, SDK-SPLIT SP4g), plain
 *  arithmetic cannot, so fixtures built on it give the same bits on every CI host. */
export function wave(t: number): number {
  const f = t - Math.floor(t)
  return 32 * f * f * (1 - f) * (1 - f) - 1
}

type Vec2 = [number, number]
interface Noise {
  readonly get: (x: number, y: number) => number
  readonly fbm: (x: number, y: number, octaves?: number) => number
  readonly ridged: (x: number, y: number, octaves?: number) => number
}
interface TerrainNoise {
  readonly n: Noise
  readonly n2: Noise
}
interface Field {
  readonly heightAt: (x: number, z: number) => number
  readonly trailDistance: (x: number, z: number) => number
}

const trail: Vec2[] = [
  [-200, -40],
  [-60, 10],
  [40, 30],
  [180, 120],
]
const ridge: Vec2[] = [
  [-120, 150],
  [0, 90],
  [130, 60],
]

export const TERRAIN_SPECS: readonly {
  readonly name: string
  readonly seed: number
  readonly spec: TerrainSpec
}[] = [
  {
    name: 'meadow-pond',
    seed: 0x5ea1,
    spec: {
      landscape: (x: number, z: number, noise: TerrainNoise): number =>
        18 * noise.n.fbm(x * 0.004, z * 0.004) +
        6 * noise.n2.ridged(x * 0.01, z * 0.01),
      trails: [trail],
      cabinSites: [
        { x: 60, z: -70, rot: 0.4 },
        { x: -110, z: 80, rot: 2 },
      ],
      pond: { x: -30, z: -120, r: 26 },
      pondFill: 0.8,
      finish: (x: number, z: number, h: number): number =>
        h + 0.25 * wave(x / 125) * wave(z / 125 + 0.25),
      splat: (
        x: number,
        z: number,
        t: Field,
        noise: TerrainNoise,
      ): [number, number, number, number] => {
        const h = t.heightAt(x, z),
          td = t.trailDistance(x, z)
        return [
          1 + Math.max(0, noise.n.get(x * 0.02, z * 0.02)),
          Math.max(0, h * 0.05),
          td < 6 ? 2 : 0.1,
          0.2,
        ]
      },
    },
  },
  {
    name: 'graded-crag',
    seed: 123456789,
    spec: {
      landscape: (x: number, z: number, noise: TerrainNoise): number =>
        40 * noise.n.ridged(x * 0.006, z * 0.006, 5) - 10,
      trails: [],
      cabinSites: [],
      graded: { paths: [ridge], maxGrade: 0.18 },
    },
  },
  {
    name: 'bench-ocean',
    seed: 7,
    spec: {
      landscape: (x: number, z: number, noise: TerrainNoise): number =>
        12 * noise.n.fbm(x * 0.008, z * 0.008, 3) + 3,
      trails: [trail.map(([x, z]): Vec2 => [z, x])],
      cabinSites: [{ x: 0, z: 0, rot: 0 }],
      oceanLevel: -2,
      graded: { paths: [ridge], maxGrade: 0.1, bench: true },
    },
  },
]

/** The sample points: a 9 × 9 lattice across the cell plus the entry roads, the pond and the cell corners. */
export const TERRAIN_POINTS: readonly (readonly [number, number])[] = [
  ...Array.from({ length: 81 }, (_, i): [number, number] => [
    -240 + (i % 9) * 60,
    -240 + Math.floor(i / 9) * 60,
  ]),
  [0, 250],
  [0, 230],
  [250, 0],
  [-245, 3],
  [4, -200],
  [-30, -120],
  [-20, -110],
  [250, 250],
  [-250, -250],
  [61.5, -69.25],
]
