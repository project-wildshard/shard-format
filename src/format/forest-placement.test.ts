/* oxlint-disable curly, id-length, import/consistent-type-specifier-style, max-lines-per-function, max-statements, oxc/no-map-spread, prefer-destructuring, typescript/explicit-function-return-type, typescript/no-unsafe-type-assertion, typescript/prefer-readonly-parameter-types, unicorn/no-array-callback-reference -- golden-vector oracle and fixtures (SDK-SPLIT SP4): written to match the engine side byte for byte */
// SDK-SPLIT SP4d (Q35): forest placement and the grass field are format laws. forest-placement.golden.json was sampled
// from the engine's own placeForest, canopyMapOf, TreeGrid, THREE.Color.setHSL and GrassField
// (forest-placement.golden-gen.mjs) over forest-placement.golden-specs.ts, so this proves format's copies place the same
// trees and grow the same grass bit for bit, with no three.js, no level and no installed terrain.
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { CHUNK_HALF } from './contentBounds.ts'
import {
  FOREST_CASES,
  FOREST_QUERIES,
  GRASS_CASES,
  HSL_CASES,
  bits,
  digest,
  fixturePaint,
  treeRow,
} from './forest-placement.golden-specs.ts'
import {
  canopyMapOf,
  hslToRgb,
  placeForest,
  placeForestSteps,
  treeGridOf,
} from './forest-placement.ts'
import { GrassField } from './grass-field.ts'
import { TERRAIN_POINTS, TERRAIN_SPECS } from './terrain-field.golden-specs.ts'
import { buildTerrain, type TerrainField } from './terrain-field.ts'

interface Golden {
  readonly forests: readonly {
    readonly name: string
    readonly count: number
    readonly digest: string
    readonly head: readonly string[]
    readonly canopy: readonly [string, string]
    readonly nearby: readonly (readonly (readonly number[])[])[]
  }[]
  readonly hsl: readonly (readonly string[])[]
  readonly grass: readonly {
    readonly name: string
    readonly samples: readonly (readonly string[])[]
    readonly trail: readonly string[]
  }[]
}
const golden = JSON.parse(
  readFileSync(
    new URL('forest-placement.golden.json', import.meta.url),
    'utf8',
  ),
) as Golden

function terrainOf(name: string): TerrainField {
  const entry = TERRAIN_SPECS.find(spec => spec.name === name)
  if (entry === undefined) throw new Error(`no fixture terrain ${name}`)
  return buildTerrain(entry.seed, entry.spec)
}

describe('forest placement matches the engine bit for bit', () => {
  it('covers every fixture forest', () => {
    expect(golden.forests.map(f => f.name)).toEqual(
      FOREST_CASES.map(c => c.name),
    )
  })
  for (const [index, c] of FOREST_CASES.entries()) {
    it(`${c.name}: trees, canopy map and trunk queries`, () => {
      const want = golden.forests[index]
      const t = terrainOf(c.terrain)
      const source = {
        seed: c.seed,
        treeCount: c.treeCount,
        ...(c.forest === undefined ? {} : { forest: c.forest }),
        heightAt: t.heightAt,
        normalAt: t.normalAt,
        trailDistance: t.trailDistance,
        cabinMask: t.cabinMask,
        pondMask: t.pondMask,
      }
      const { trees, grid } = placeForest(c.variants, source)
      const rows = trees.map(tree => treeRow(tree, tree.tint))
      expect(trees.length).toBe(want?.count)
      expect(rows.slice(0, 24)).toEqual(want?.head)
      expect(digest(rows)).toBe(want?.digest)
      expect([
        digest(canopyMapOf(trees)),
        digest(canopyMapOf(trees, 64)),
      ]).toEqual(want?.canopy)
      expect(
        FOREST_QUERIES.map(([x, z]) =>
          [2, 9].map(r => grid.nearby(x, z, r).map(o => trees.indexOf(o))),
        ),
      ).toEqual(want?.nearby)
      const rebuilt = treeGridOf(trees)
      expect(
        FOREST_QUERIES.map(([x, z]) => rebuilt.nearby(x, z, 9).length),
      ).toEqual(want?.nearby.map(q => q[1]?.length))
    })
  }
  it('places the same trees in steps, yielding without drawing', () => {
    const c = FOREST_CASES[0]
    if (c === undefined) throw new Error('no fixture')
    const t = terrainOf(c.terrain)
    const steps = placeForestSteps(c.variants, {
      seed: c.seed,
      treeCount: c.treeCount,
      ...(c.forest === undefined ? {} : { forest: c.forest }),
      heightAt: t.heightAt,
      normalAt: t.normalAt,
      trailDistance: t.trailDistance,
      cabinMask: t.cabinMask,
      pondMask: t.pondMask,
    })
    let yields = 0
    for (let step = steps.next(); step.done !== true; step = steps.next())
      yields += 1
    expect(yields).toBeGreaterThan(3)
  })
  it('tints with three.js Color.setHSL in the linear working space', () => {
    expect(HSL_CASES.map(([h, s, l]) => hslToRgb(h, s, l).map(bits))).toEqual(
      golden.hsl,
    )
  })
})

describe('the grass field matches the engine bit for bit', () => {
  it('covers every fixture meadow', () => {
    expect(golden.grass.map(g => g.name)).toEqual(GRASS_CASES.map(c => c.name))
  })
  for (const [index, c] of GRASS_CASES.entries()) {
    it(`${c.name}: base height, exact height, every lattice channel and the trail verge`, () => {
      const want = golden.grass[index]
      const t = terrainOf(c.terrain)
      const field = new GrassField({
        seed: c.seed,
        half: CHUNK_HALF,
        heightAt: t.heightAt,
        normalAt: (x, z, eps) => t.normalAt(x, z, eps),
        splatAt: t.splatAt,
        trailDistance: t.trailDistance,
        cabinMask: t.cabinMask,
        pondMask: t.pondMask,
        waterLevel: t.waterLevel,
        paint: c.paint ? fixturePaint : (): boolean => false,
        layout: c.layout,
      })
      const samples = TERRAIN_POINTS.map(([x, z]) => [
        bits(field.baseHeightAt(x, z)),
        bits(
          field.baseHeightAt(x + 0.7, z - 1.3, Number.POSITIVE_INFINITY, true),
        ),
        ...[0, 1, 2, 3, 4, 5, 6, 7].map(ch =>
          bits(field.sample(x + 1.1, z + 2.9, ch)),
        ),
      ])
      expect(samples).toEqual(want?.samples)
      expect(
        [
          [0.5, 0],
          [0.5, 2],
          [0.9, 4.2],
          [1.1, 5.5],
          [0.3, 9],
        ].map(([h, td]) => bits(field.trailGrass(h ?? 0, td ?? 0))),
      ).toEqual(want?.trail)
    })
  }
})
