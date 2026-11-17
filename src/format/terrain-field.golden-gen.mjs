/* oxlint-disable id-length, import/newline-after-import, import/no-nodejs-modules, no-magic-numbers, node/no-sync, typescript/no-unsafe-argument, typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return, typescript/prefer-readonly-parameter-types, unicorn/import-style, unicorn/no-array-callback-reference, unicorn/number-literal-case, unicorn/numeric-separators-style -- golden-vector oracle and fixtures (SDK-SPLIT SP4): written to match the engine side byte for byte */
// Golden vectors for SDK-SPLIT SP4b, sampled from the ENGINE's buildTerrain and Noise2D (the oracle).
// Usage: node --import <engine>/scripts/sim-node-loader.mjs src/format/terrain-field.golden-gen.mjs <engine src/shared/engine> <out.json>
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { TERRAIN_POINTS, TERRAIN_SPECS } from './terrain-field.golden-specs.ts'
const { buildTerrain, buildTerrainMetadata, landscapeHash } = await import(
  join(process.argv[2], 'world/terrainField.ts')
)
const { Noise2D, smoothstep, clamp, lerp } = await import(
  join(process.argv[2], 'core/noise.ts')
)
const bits = x => {
  const b = new DataView(new ArrayBuffer(8))
  b.setFloat64(0, x)
  return b.getBigUint64(0).toString(16).padStart(16, '0')
}
const fields = TERRAIN_SPECS.map(({ name, seed, spec }) => {
  const t = buildTerrain(seed, spec)
  const meta = buildTerrainMetadata(seed, spec, t.waterLevel)
  return {
    name,
    seed,
    landscapeHash: landscapeHash(t),
    waterLevel: bits(t.waterLevel()),
    samples: TERRAIN_POINTS.map(([x, z]) => [
      bits(t.heightAt(x, z)),
      t.normalAt(x, z).map(bits),
      t.splatAt(x, z).map(bits),
      bits(t.trailDistance(x, z)),
      bits(t.cabinMask(x, z)),
      bits(t.pondMask(x, z)),
      bits(meta.pondMask(x, z)),
    ]),
  }
})
const noise = [0, 1, 0x5ea1, 0xffffffff].map(seed => {
  const n = new Noise2D(seed)
  return {
    seed,
    samples: TERRAIN_POINTS.slice(0, 30).map(([x, z]) => [
      bits(n.get(x * 0.013, z * 0.017)),
      bits(n.fbm(x * 0.004, z * 0.004)),
      bits(n.ridged(x * 0.01, z * 0.01)),
    ]),
  }
})
const helpers = [
  [0, 1, 0.3],
  [2, 5, 4.9],
  [-1, 1, -3],
].map(([a, b, x]) => [
  bits(smoothstep(a, b, x)),
  bits(clamp(x, a, b)),
  bits(lerp(a, b, x)),
])
writeFileSync(
  process.argv[3],
  `${JSON.stringify({ about: 'SDK-SPLIT SP4b: engine world/terrainField.ts and core/noise.ts samples over terrain-field.golden-specs.ts; floats are IEEE-754 float64 bits, big-endian hex', fields, noise, helpers })}\n`,
)
