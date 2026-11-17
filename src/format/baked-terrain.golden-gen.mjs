/* oxlint-disable id-length, import/newline-after-import, import/no-nodejs-modules, no-bitwise, no-magic-numbers, node/no-sync, typescript/no-unsafe-argument, typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return, typescript/prefer-readonly-parameter-types, unicorn/import-style, unicorn/no-array-callback-reference -- golden-vector oracle and fixtures (SDK-SPLIT SP4): written to match the engine side byte for byte */
// Golden vectors for SDK-SPLIT SP4c, sampled through the ENGINE's BakedTerrain exports (what the engine calls).
// Usage: node --import <engine>/scripts/sim-node-loader.mjs src/format/baked-terrain.golden-gen.mjs <engine src/shared/engine> <out.json>
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { fixtureBakedBytes } from './baked-terrain.golden-specs.ts'
import { TERRAIN_POINTS, TERRAIN_SPECS } from './terrain-field.golden-specs.ts'
const { parseBakedTerrain, bakedSamplers } = await import(
  join(process.argv[2], 'world/BakedTerrain.ts')
)
const bits = x => {
  const b = new DataView(new ArrayBuffer(8))
  b.setFloat64(0, x)
  return b.getBigUint64(0).toString(16).padStart(16, '0')
}
const grids = TERRAIN_SPECS.map((entry, index) => {
  const grid = parseBakedTerrain(fixtureBakedBytes(index), {
    res: 33,
    seed: entry.seed >>> 0,
  })
  const s = bakedSamplers(grid)
  return {
    name: entry.name,
    res: grid.res,
    size: grid.size,
    seed: grid.seed,
    samples: TERRAIN_POINTS.map(([x, z]) => [
      bits(s.heightAt(x, z)),
      s.normalAt(x, z).map(bits),
      s.splatAt(x, z).map(bits),
    ]),
  }
})
const refused = [
  parseBakedTerrain(new Uint8Array(10)),
  parseBakedTerrain(fixtureBakedBytes(0), { res: 32 }),
  parseBakedTerrain(fixtureBakedBytes(0), { seed: 1 }),
].map(g => g === null)
writeFileSync(
  process.argv[3],
  `${JSON.stringify({ about: 'SDK-SPLIT SP4c: engine world/BakedTerrain.ts parseBakedTerrain + bakedSamplers over baked-terrain.golden-specs.ts grids; floats are IEEE-754 float64 bits, big-endian hex', grids, refused })}\n`,
)
