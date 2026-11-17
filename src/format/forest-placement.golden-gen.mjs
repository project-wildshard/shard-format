/* oxlint-disable curly, id-length, import/newline-after-import, import/no-nodejs-modules, no-magic-numbers, node/no-sync, oxc/no-map-spread, typescript/no-unsafe-argument, typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/import-style, unicorn/no-array-callback-reference, unicorn/no-null -- golden-vector oracle and fixtures (SDK-SPLIT SP4): written to match the engine side byte for byte */
// Golden vectors for SDK-SPLIT SP4d, from the ENGINE's placeForest, canopyMapOf, TreeGrid, THREE.Color.setHSL and
// GrassField (the oracle) over forest-placement.golden-specs.ts on the engine's own buildTerrain.
// Usage: node --import <engine>/scripts/sim-node-loader.mjs src/format/forest-placement.golden-gen.mjs <engine src/shared/engine> <out.json>
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

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
import { TERRAIN_POINTS, TERRAIN_SPECS } from './terrain-field.golden-specs.ts'
const { buildTerrain } = await import(
  join(process.argv[2], 'world/terrainField.ts')
)
const { placeForest, canopyMapOf } = await import(
  join(process.argv[2], 'world/forest/placement.ts')
)
const { GrassField } = await import(
  join(process.argv[2], '../game/systems/looks/grassField.ts')
)
const { CHUNK_HALF } = await import(join(process.argv[2], 'core/config.ts'))
const terrainOf = name => {
  const t = TERRAIN_SPECS.find(s => s.name === name)
  return buildTerrain(t.seed, t.spec)
}
let Color = null
const forests = FOREST_CASES.map(c => {
  const t = terrainOf(c.terrain)
  const source = {
    seed: c.seed,
    treeCount: c.treeCount,
    forest: c.forest,
    heightAt: t.heightAt,
    normalAt: t.normalAt,
    trailDistance: t.trailDistance,
    cabinMask: t.cabinMask,
    pondMask: t.pondMask,
  }
  const { trees, grid } = placeForest(c.variants, source)
  if (trees[0]) Color = trees[0].tint.constructor
  const rows = trees.map(tree =>
    treeRow(tree, [tree.tint.r, tree.tint.g, tree.tint.b]),
  )
  return {
    name: c.name,
    count: trees.length,
    digest: digest(rows),
    head: rows.slice(0, 24),
    canopy: [digest(canopyMapOf(trees)), digest(canopyMapOf(trees, 64))],
    nearby: FOREST_QUERIES.map(([x, z]) =>
      [2, 9].map(r => grid.nearby(x, z, r).map(o => trees.indexOf(o))),
    ),
  }
})
const hsl = HSL_CASES.map(([h, s, l]) => {
  const c = new Color().setHSL(h, s, l)
  return [c.r, c.g, c.b].map(bits)
})
const grass = GRASS_CASES.map(c => {
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
    paint: c.paint ? fixturePaint : () => false,
    layout: c.layout,
  })
  return {
    name: c.name,
    samples: TERRAIN_POINTS.map(([x, z]) => [
      bits(field.baseHeightAt(x, z)),
      bits(field.baseHeightAt(x + 0.7, z - 1.3, Infinity, true)),
      ...[0, 1, 2, 3, 4, 5, 6, 7].map(ch =>
        bits(field.sample(x + 1.1, z + 2.9, ch)),
      ),
    ]),
    trail: [
      [0.5, 0],
      [0.5, 2],
      [0.9, 4.2],
      [1.1, 5.5],
      [0.3, 9],
    ].map(([h, td]) => bits(field.trailGrass(h, td))),
  }
})
writeFileSync(
  process.argv[3],
  `${JSON.stringify({ about: 'SDK-SPLIT SP4d: engine world/forest/placement.ts, three Color.setHSL and game/systems/looks/grassField.ts over forest-placement.golden-specs.ts; floats are IEEE-754 float64 bits, big-endian hex', forests, hsl, grass })}\n`,
)
