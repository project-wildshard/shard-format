/* oxlint-disable capitalized-comments, complexity, curly, id-length, import/exports-last, import/group-exports, max-depth, max-lines, max-lines-per-function, max-params, max-statements, no-bitwise, no-continue, no-inline-comments, no-magic-numbers, no-nested-ternary, no-param-reassign, no-plusplus, no-use-before-define, typescript/explicit-function-return-type, typescript/explicit-member-accessibility, typescript/prefer-readonly, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-array-for-each, unicorn/no-nested-ternary, unicorn/no-null, unicorn/numeric-separators-style -- verbatim port of the engine's law (SDK-SPLIT SP4); bit-exact output is pinned by golden vectors, so it keeps the engine's form */
/**
 * SDK-SPLIT SP4d (Q35): moved from engine `shared/engine/world/forest/placement.ts`; the bake and the engine plant one
 * forest. Where the forest goes, with no three.js, no active level and no installed terrain: the caller hands the
 * terrain samplers, the seed, the tree cap and the forest spec (`ForestPlacementSource`), and gets plain tree records
 * whose tint is a linear rgb triple (three's `Color.setHSL` in the linear working space, `hslToRgb`). The engine wraps
 * these in its `THREE.Color` instances; the build keeps them as numbers.
 */
import { CHUNK_HALF, CHUNK_SIZE } from './contentBounds.ts'
import { Noise2D, smoothstep } from './noise.ts'
import { Rng } from './seeded-rng.ts'

export type TreeSpecies = string
export type SpeciesWeights = Partial<Record<TreeSpecies, number>>
/** how a species is planted: its scale range; whether it follows the zone's growth (ForestPlacementSpec.scale); the trunk's
 *  extra girth (m); its spacing — 'wide' keeps every neighbour 3.5 m off (a giant's buttresses), 'tight' 0.6 m (a sapling),
 *  else 1.2 m; a hue shift of its tint */
export interface TreeSpeciesTraits {
  readonly id: TreeSpecies
  readonly scale: readonly [number, number]
  readonly grows: boolean
  readonly girth: number
  readonly spacing: 'wide' | 'normal' | 'tight'
  readonly hue?: number
}

/** A shard's forest: the engine's `ForestSpec` (level data), structurally. */
export interface ForestPlacementSpec {
  spacing: number
  densityFreq: number
  clearings: [number, number]
  maxSlope: number
  tintHue: number
  tintHueJitter: [number, number]
  tintSat: [number, number]
  tintLight: [number, number]
  largeVariantChance: number
  density?: (x: number, z: number) => number
  scale?: (x: number, z: number) => number
  species?: (x: number, z: number) => SpeciesWeights
  /** how each species of the set is planted, in draw order (needed with `species`) */
  speciesTraits?: readonly TreeSpeciesTraits[]
  understory?: { ferns: number; shrubs: number; fernCanopy: boolean }
  infill?: { x: number; z: number; r: number }
  mask?: (x: number, z: number) => number
}

/** A linear rgb colour, each channel 0..1. */
export type Rgb = [number, number, number]

/** One placed tree: its foot (ground − 0.25), trunk collision radius, variant, scale, yaw, height and linear tint. */
export interface ForestTree {
  x: number
  y: number
  z: number
  r: number
  variant: number
  scale: number
  rot: number
  height: number
  tint: Rgb
  species?: TreeSpecies | undefined
}

const euclideanModulo = (n: number, m: number): number => ((n % m) + m) % m
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))
function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * 6 * (2 / 3 - t)
  return p
}
/** three.js `Color.setHSL(h, s, l)` in the linear working space (no colour-space conversion), as a linear rgb triple. */
export function hslToRgb(h: number, s: number, l: number): Rgb {
  // h,s,l ranges are in 0.0 - 1.0
  h = euclideanModulo(h, 1)
  s = clamp01(s)
  l = clamp01(l)
  if (s === 0) return [l, l, l]
  const p = l <= 0.5 ? l * (1 + s) : l + s - l * s
  const q = 2 * l - p
  return [hue2rgb(q, p, h + 1 / 3), hue2rgb(q, p, h), hue2rgb(q, p, h - 1 / 3)]
}

/** the chunk test the engine's Heightfield makes: (x, z) at least `margin` inside the cell */
function inChunk(x: number, z: number, margin = 0): boolean {
  return (
    Math.abs(x) <= CHUNK_HALF - margin && Math.abs(z) <= CHUNK_HALF - margin
  )
}

/**
 * The soft canopy density over the chunk (`n` x `n` cells, row-major, z rows): each tree's crown as a disc of radius
 * 0.16 x its height, summed and capped at 1. The ground darkens and grass thins by it; the forest builds it at runtime and
 * a tiled ground bakes it into a per-vertex channel (G227 `_CANOPY`). Pure: the same trees give the same map.
 */
export function canopyMapOf(
  trees: readonly Pick<ForestTree, 'x' | 'z' | 'height'>[],
  n = 256,
): Float32Array {
  const data = new Float32Array(n * n)
  const toCell = (v: number): number => ((v + CHUNK_HALF) / CHUNK_SIZE) * n
  for (const t of trees) {
    const r = (t.height * 0.16) / (CHUNK_SIZE / n) // crown radius in cells
    const cx = toCell(t.x),
      cz = toCell(t.z)
    const R = Math.ceil(r + 1)
    for (let j = -R; j <= R; j++)
      for (let i = -R; i <= R; i++) {
        const x = Math.round(cx) + i,
          z = Math.round(cz) + j
        if (x < 0 || z < 0 || x >= n || z >= n) continue
        const d = Math.hypot(x - cx, z - cz) / r
        if (d < 1)
          data[z * n + x] = Math.min(
            1,
            (data[z * n + x] ?? 0) + (1 - d * d) * 0.7,
          )
      }
  }
  return data
}

/** What placement needs of a variant (TreeFactory's variants carry these; the build's bakes pass them from the specs). */
export interface PlantSpec {
  trunkRadius: number
  height: number
  species?: TreeSpecies | undefined
  collider?: number | undefined
}

/** Explicit forest construction inputs: the terrain samplers, the seed, the tree cap and the forest (none: no trees).
 *  Supplying this never selects a level, installs terrain or changes page constants. */
export interface ForestPlacementSource {
  readonly heightAt: (x: number, z: number) => number
  readonly normalAt: (
    x: number,
    z: number,
    eps?: number,
  ) => readonly [number, number, number]
  readonly trailDistance: (x: number, z: number) => number
  readonly cabinMask: (x: number, z: number) => number
  readonly pondMask: (x: number, z: number) => number
  readonly seed: number
  readonly treeCount: number
  readonly forest?: ForestPlacementSpec
}

/** A 16 m grid cell as one integer (exact for cells within 2^20 of the origin: any coordinate a query meets in play). */
const cellKey = (cx: number, cz: number): number =>
  (cx + 1048576) * 2097152 + (cz + 1048576)

/** Trees bucketed in 16 m cells, for "which trunks are near (x, z)" (collision, planting, herds, bolts); generic over the
 *  tree's record, so a renderer-free host buckets its baked trunks exactly as the page's forest does. */
export class TreeGrid<
  T extends { readonly x: number; readonly z: number; readonly r: number } =
    ForestTree,
> {
  private cells = new Map<number, T[]>()
  add(t: T): void {
    const k = cellKey(Math.floor(t.x / 16), Math.floor(t.z / 16))
    let bucket = this.cells.get(k)
    if (!bucket) {
      bucket = []
      this.cells.set(k, bucket)
    }
    bucket.push(t)
  }
  /** trees whose trunk might intersect a circle at (x,z) */
  nearby(x: number, z: number, radius = 2): T[] {
    const out: T[] = []
    const cx = Math.floor(x / 16),
      cz = Math.floor(z / 16)
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++) {
        const list = this.cells.get(cellKey(cx + i, cz + j))
        if (list)
          for (const t of list) {
            const dx = t.x - x,
              dz = t.z - z,
              reach = radius + t.r + 3
            // Reject only outside the circle's box; keep the exact trunk-distance law.
            if (Math.abs(dx) > reach || Math.abs(dz) > reach) continue
            if (Math.hypot(dx, dz) < reach) out.push(t)
          }
      }
    return out
  }
}

/** The source's trees for these variants (none for an empty list: a treeless shard). */
export function placeForest(
  variants: readonly PlantSpec[],
  source: ForestPlacementSource,
): { trees: ForestTree[]; grid: TreeGrid } {
  const steps = placeForestSteps(variants, source)
  for (;;) {
    const step = steps.next()
    if (step.done === true) return step.value
  }
}

/** `placeForest` as steps (SF67: `Forest.buildSliced` pauses between them): a yield every 256 candidates, which draws
 *  nothing, so the same trees from the same stream */
export function* placeForestSteps(
  variants: readonly PlantSpec[],
  source: ForestPlacementSource,
): Generator<void, { trees: ForestTree[]; grid: TreeGrid }> {
  const trees: ForestTree[] = []
  const grid = new TreeGrid()
  if (variants.length === 0) return { trees, grid }
  const F = source.forest
  if (!F) return { trees, grid } // no ShardManifest.forest: no forest to place
  const rng = new Rng(source.seed + 99)
  const density = new Noise2D(source.seed + 5)
  const cell = F.spacing // metres between candidates → ~3400 candidates at 8.5, thinned by density
  const half = CHUNK_HALF - 6
  const candidates: [number, number][] = []
  for (let x = -half; x < half; x += cell)
    for (let z = -half; z < half; z += cell) {
      candidates.push([
        x + rng.range(-cell * 0.45, cell * 0.45),
        z + rng.range(-cell * 0.45, cell * 0.45),
      ])
    }
  // shuffle so thinning is unbiased
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    const a = candidates[i],
      b = candidates[j]
    if (a && b) {
      candidates[i] = b
      candidates[j] = a
    }
  }

  // PH-B4: a species set picks each tree's species from the chunk's zone mix, then one of that species' variants
  const mix =
    F.species && F.speciesTraits && variants.every(v => v.species !== undefined)
      ? F.species
      : null
  const traits: readonly TreeSpeciesTraits[] = F.speciesTraits ?? []
  const traitOf = new Map(traits.map(t => [t.id, t]))
  const bySpecies = new Map<TreeSpecies, number[]>()
  variants.forEach((v, i) => {
    if (v.species)
      bySpecies.set(v.species, [...(bySpecies.get(v.species) ?? []), i])
  })
  const plantSpecies = (
    x: number,
    y: number,
    z: number,
    w: SpeciesWeights,
  ): void => {
    let total = 0
    for (const { id: s } of traits)
      total += bySpecies.has(s) ? Math.max(0, w[s] ?? 0) : 0
    if (total <= 0) return
    let r = rng.next() * total,
      species: TreeSpecies = traits[0]?.id ?? ''
    for (const { id: s } of traits) {
      const k = bySpecies.has(s) ? Math.max(0, w[s] ?? 0) : 0
      if (r < k) {
        species = s
        break
      }
      r -= k
    }
    const list = bySpecies.get(species) ?? []
    const variant = list[rng.int(0, list.length - 1)] ?? 0
    const v = variants[variant]
    if (!v) throw new Error(`[forest] no tree variant ${variant}`)
    const trait = traitOf.get(species)
    if (trait === undefined)
      throw new Error(`[forest] no traits for species '${species}'`)
    const scale =
      rng.range(trait.scale[0], trait.scale[1]) *
      (trait.grows && F.scale ? F.scale(x, z) : 1)
    const r0 = v.trunkRadius * scale * (v.collider ?? 1) + trait.girth
    // no trunk inside another's: a giant keeps its neighbours off its buttresses and out from under its limbs
    for (const o of grid.nearby(x, z, r0 + 8)) {
      const other =
        o.species === undefined ? undefined : traitOf.get(o.species)?.spacing
      const gap =
        trait.spacing === 'wide' || other === 'wide'
          ? 3.5
          : trait.spacing === 'tight' || other === 'tight'
            ? 0.6
            : 1.2
      if (Math.hypot(o.x - x, o.z - z) < o.r + r0 + gap) return
    }
    const h = F.tintHue + rng.range(F.tintHueJitter[0], F.tintHueJitter[1])
    const tint = hslToRgb(
      h + (trait.hue ?? 0),
      rng.range(0.1, 0.3),
      rng.range(0.8, 0.95),
    )
    const t: ForestTree = {
      x,
      y: y - 0.25,
      z,
      r: r0,
      variant,
      scale,
      rot: rng.range(0, Math.PI * 2),
      height: v.height * scale,
      tint,
      species,
    }
    trees.push(t)
    grid.add(t)
  }
  // a zone's infill (ChunkForest.infill; Pine Hollow's Hollow grove, PH-L1 round 2): a second candidate grid half a cell
  // off the first, inside a circle, tested after the chunk's own (so every tree the grid placed stays where it was)
  const infill: [number, number][] = []
  const fill = F.infill
  if (fill) {
    for (let x = fill.x - fill.r + cell / 2; x < fill.x + fill.r; x += cell)
      for (let z = fill.z - fill.r + cell / 2; z < fill.z + fill.r; z += cell) {
        const jx = x + rng.range(-cell * 0.3, cell * 0.3),
          jz = z + rng.range(-cell * 0.3, cell * 0.3)
        if (Math.hypot(jx - fill.x, jz - fill.z) < fill.r) infill.push([jx, jz])
      }
  }
  let tested = 0
  for (const [x, z] of [...candidates, ...infill]) {
    if ((++tested & 255) === 0) yield
    if (trees.length >= source.treeCount) break
    if (!inChunk(x, z, 4)) continue
    const d = density.fbm(x * F.densityFreq, z * F.densityFreq, 3) // clearings & dense groves
    const keep =
      (smoothstep(F.clearings[0], F.clearings[1], d) * 0.92 + 0.08) *
      (F.density ? F.density(x, z) : 1)
    if (rng.next() > keep) continue
    if (F.mask && rng.next() > F.mask(x, z)) continue // a shard's own planting field (Nalati's spruce gullies)
    const roadEntry =
      (Math.abs(x) < 16 && Math.abs(z) > CHUNK_HALF - 95) ||
      (Math.abs(z) < 16 && Math.abs(x) > CHUNK_HALF - 95)
    if (roadEntry) continue
    if (source.trailDistance(x, z) < 9 + rng.range(0, 4)) continue
    if (source.cabinMask(x, z) > 0.02) continue
    if (source.pondMask(x, z) > 0.03) continue
    const [, ny] = source.normalAt(x, z)
    if (ny < F.maxSlope) continue // too steep
    const y = source.heightAt(x, z)
    if (mix) {
      plantSpecies(x, y, z, mix(x, z))
      continue
    }
    const variant = rng.next() < F.largeVariantChance ? 3 : rng.int(0, 2)
    const scale = rng.range(0.8, 1.2) * (F.scale ? F.scale(x, z) : 1)
    const v = variants[variant]
    if (!v) throw new Error(`[forest] no tree variant ${variant}`)
    const tint = hslToRgb(
      F.tintHue + rng.range(F.tintHueJitter[0], F.tintHueJitter[1]),
      rng.range(F.tintSat[0], F.tintSat[1]),
      rng.range(F.tintLight[0], F.tintLight[1]),
    )
    const t: ForestTree = {
      x,
      y: y - 0.25,
      z,
      r: v.trunkRadius * scale + 0.15,
      variant,
      scale,
      rot: rng.range(0, Math.PI * 2),
      height: v.height * scale,
      tint,
    }
    trees.push(t)
    grid.add(t)
  }
  return { trees, grid }
}

/** The 16 m lookup grid over given trees (what `placeForest` returns beside them). */
export function treeGridOf<
  T extends { readonly x: number; readonly z: number; readonly r: number },
>(trees: readonly T[]): TreeGrid<T> {
  const grid = new TreeGrid<T>()
  for (const t of trees) grid.add(t)
  return grid
}
