import { wave } from './terrain-field.golden-specs.ts'

/* oxlint-disable curly, id-length, import/exports-last, import/group-exports, max-params, no-bitwise, no-magic-numbers, prefer-template, typescript/prefer-readonly-parameter-types, unicorn/no-array-callback-reference, unicorn/no-null, unicorn/number-literal-case, unicorn/numeric-separators-style -- golden-vector oracle and fixtures (SDK-SPLIT SP4): written to match the engine side byte for byte */
// SDK-SPLIT SP4d: forest and grass fixtures whose placements the golden vectors pin. Each names a terrain of
// terrain-field.golden-specs.ts; the engine's placeForest / GrassField (the oracle, forest-placement.golden-gen.mjs) and
// format's run over the same field. Together they touch every branch: the plain draw and its large variant, a species
// mix with wide / tight / normal spacing, a hue shift and growth, a density field with bare pads, a planting mask, an
// infill grove, the tree cap, a treeless and a forestless source; a plain meadow and an authored one with a painted ground.
import type { ForestPlacementSpec, PlantSpec } from './forest-placement.ts'
import type { GrassFieldLayout } from './grass-field.ts'

const plainVariants: readonly PlantSpec[] = [
  { trunkRadius: 0.35, height: 9 },
  { trunkRadius: 0.4, height: 11 },
  { trunkRadius: 0.3, height: 7.5 },
  { trunkRadius: 0.7, height: 18 },
]
const speciesVariants: readonly PlantSpec[] = [
  { trunkRadius: 0.5, height: 14, species: 'pine', collider: 0.8 },
  { trunkRadius: 0.55, height: 16, species: 'pine' },
  { trunkRadius: 1.4, height: 30, species: 'giant', collider: 1.2 },
  { trunkRadius: 0.15, height: 3, species: 'sapling' },
  { trunkRadius: 0.4, height: 10, species: 'birch', collider: 1 },
]
const plain: ForestPlacementSpec = {
  spacing: 8.5,
  densityFreq: 0.011,
  clearings: [-0.25, 0.3],
  maxSlope: 0.82,
  tintHue: 0.28,
  tintHueJitter: [-0.04, 0.03],
  tintSat: [0.3, 0.55],
  tintLight: [0.32, 0.5],
  largeVariantChance: 0.12,
}

export const FOREST_CASES: readonly {
  readonly name: string
  readonly terrain: string
  readonly seed: number
  readonly treeCount: number
  readonly variants: readonly PlantSpec[]
  readonly forest?: ForestPlacementSpec
}[] = [
  {
    name: 'plain',
    terrain: 'meadow-pond',
    seed: 1337,
    treeCount: 2200,
    variants: plainVariants,
    forest: plain,
  },
  {
    name: 'capped-grown',
    terrain: 'graded-crag',
    seed: 99,
    treeCount: 140,
    variants: plainVariants,
    forest: {
      ...plain,
      tintHue: 0.97,
      spacing: 6,
      scale: (x: number, z: number): number =>
        0.8 + 0.4 * Math.abs(wave((x + 2 * z) / 628)),
      mask: (x: number, z: number): number => (x > 100 && z < 150 ? 0.2 : 1),
    },
  },
  {
    name: 'species-infill',
    terrain: 'bench-ocean',
    seed: 0x5ea1,
    treeCount: 3000,
    variants: speciesVariants,
    forest: {
      ...plain,
      spacing: 9,
      species: (x: number, z: number): Partial<Record<string, number>> => ({
        pine: 2 + wave(x / 314),
        giant: z > 0 ? 0.6 : 0,
        sapling: 0.8,
        birch: x < -50 ? 1.5 : -1,
        ghost: 5,
      }),
      speciesTraits: [
        {
          id: 'pine',
          scale: [0.8, 1.2],
          grows: true,
          girth: 0.1,
          spacing: 'normal',
        },
        {
          id: 'giant',
          scale: [1, 1.3],
          grows: false,
          girth: 1.5,
          spacing: 'wide',
          hue: -0.05,
        },
        {
          id: 'sapling',
          scale: [0.6, 1],
          grows: true,
          girth: 0,
          spacing: 'tight',
          hue: 0.08,
        },
        {
          id: 'birch',
          scale: [0.9, 1.1],
          grows: false,
          girth: 0.05,
          spacing: 'normal',
        },
        {
          id: 'ghost',
          scale: [1, 1],
          grows: false,
          girth: 0,
          spacing: 'normal',
        },
      ],
      scale: (x: number): number => (x > 0 ? 1.15 : 0.9),
      density: (x: number, z: number): number =>
        Math.hypot(x - 60, z + 40) < 35 ? 0 : 1,
      infill: { x: -80, z: 60, r: 45 },
    },
  },
  {
    name: 'treeless',
    terrain: 'meadow-pond',
    seed: 1,
    treeCount: 100,
    variants: [],
    forest: plain,
  },
  {
    name: 'forestless',
    terrain: 'meadow-pond',
    seed: 1,
    treeCount: 100,
    variants: plainVariants,
  },
]

/** Points whose `TreeGrid.nearby` lists the golden vectors pin (radius 2 and 9). */
export const FOREST_QUERIES: readonly (readonly [number, number])[] = [
  [0, 0],
  [-120, 40],
  [33.3, -77.7],
  [200, 200],
  [-80, 60],
  [61, -41],
]

/** HSL triples the tint law is pinned on directly (three's `Color.setHSL`): grey, wrap-around hue, light and dark. */
export const HSL_CASES: readonly (readonly [number, number, number])[] = [
  [0.3, 0, 0.4],
  [-0.05, 0.4, 0.3],
  [1.2, 0.7, 0.8],
  [0.5, 1.4, -0.1],
  [0.97, 0.25, 0.5],
  [0.15, 0.6, 0.62],
  [0.6, 0.3, 0.9],
]

const meadow: GrassFieldLayout = {
  short: [
    { x: 20, z: 10, r: 18, h: 0.18 },
    { x: -150, z: -60, r: 25, h: 0.3 },
  ],
  tall: [{ x: 100, z: 120, r: 40, h: 1.2 }],
  bare: [{ x: 60, z: -70, r: 5, h: 0 }],
  valley: 0.66,
  plateau: 0.72,
  riverZ: (x: number): number => -20 + 0.1 * x,
  riverHalf: (x: number): number => 6 + 0.01 * Math.abs(x),
}

export const GRASS_CASES: readonly {
  readonly name: string
  readonly terrain: string
  readonly seed: number
  readonly layout: GrassFieldLayout | null
  readonly paint: boolean
}[] = [
  {
    name: 'plain-meadow',
    terrain: 'meadow-pond',
    seed: 1337,
    layout: null,
    paint: false,
  },
  {
    name: 'authored-meadow',
    terrain: 'meadow-pond',
    seed: 42,
    layout: meadow,
    paint: true,
  },
  {
    name: 'authored-crag',
    terrain: 'graded-crag',
    seed: 7,
    layout: meadow,
    paint: false,
  },
  {
    name: 'plain-ocean',
    terrain: 'bench-ocean',
    seed: 3,
    layout: null,
    paint: true,
  },
]

/** The fixture ground paint: a slope- and height-tinted green, so the lattice's colour channels move. */
export function fixturePaint(
  x: number,
  z: number,
  y: number,
  slope: number,
  out: [number, number, number],
): boolean {
  out[0] = 0.1 + 0.002 * y + 0.0001 * x
  out[1] = 0.25 - 0.1 * slope
  out[2] = 0.05 + 0.0002 * Math.abs(z)
  return true
}

/** IEEE-754 float64 bits, big-endian hex: the comparison is bit-exact, not approximate. */
export function bits(value: number): string {
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, value)
  return view.getBigUint64(0).toString(16).padStart(16, '0')
}

/** One tree as its golden row: every number as float bits, the species last. */
export function treeRow(
  t: {
    readonly x: number
    readonly y: number
    readonly z: number
    readonly r: number
    readonly variant: number
    readonly scale: number
    readonly rot: number
    readonly height: number
    readonly species?: string | undefined
  },
  tint: readonly [number, number, number],
): string {
  return (
    [t.x, t.y, t.z, t.r, t.variant, t.scale, t.rot, t.height, ...tint]
      .map(bits)
      .join(',') + `,${t.species ?? '-'}`
  )
}

/** FNV-1a 32 over strings or the bytes of a float array, as 8 hex digits (a digest of a long golden list). */
export function digest(input: readonly string[] | Float32Array): string {
  let h = 0x811c9dc5
  const bytes =
    input instanceof Float32Array
      ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
      : new TextEncoder().encode(input.join('\n'))
  for (const b of bytes) h = Math.imul(h ^ b, 0x01000193) >>> 0
  return h.toString(16).padStart(8, '0')
}
