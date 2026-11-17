/* oxlint-disable curly, id-length, max-statements, no-bitwise, no-magic-numbers, no-plusplus, sort-vars, typescript/explicit-function-return-type, unicorn/no-array-for-each -- golden-vector oracle and fixtures (SDK-SPLIT SP4): written to match the engine side byte for byte */
// SDK-SPLIT SP4c: a fixture baked grid (WSTR v1 bytes, res 33 over the 500 m cell) encoded from the SP4b fixture fields,
// so the baked samplers' golden vectors (baked-terrain.golden.json, from the engine's BakedTerrain exports) have real
// ground to read. Not shipped.
import { TERRAIN_SPECS } from './terrain-field.golden-specs.ts'
import { buildTerrain } from './terrain-field.ts'

const RES = 33,
  SIZE = 500,
  HEADER = 24

/** WSTR v1: magic, version, res, size, seed, landscape hash, f32 heights, then four u8 splat weights per vertex. */
export function fixtureBakedBytes(index: number): Uint8Array {
  const entry = TERRAIN_SPECS[index]
  if (entry === undefined) throw new Error(`no fixture spec ${String(index)}`)
  const field = buildTerrain(entry.seed, entry.spec),
    count = RES * RES
  const buffer = new ArrayBuffer(HEADER + count * 8),
    view = new DataView(buffer)
  ;[0x57, 0x53, 0x54, 0x52].forEach((byte, at) => {
    view.setUint8(at, byte)
  })
  view.setUint32(4, 1, true)
  view.setUint32(8, RES, true)
  view.setFloat32(12, SIZE, true)
  view.setUint32(16, entry.seed >>> 0, true)
  view.setUint32(20, 0, true)
  const heights = new Float32Array(buffer, HEADER, count),
    splat = new Uint8Array(buffer, HEADER + count * 4, count * 4)
  for (let iz = 0; iz < RES; iz++)
    for (let ix = 0; ix < RES; ix++) {
      const x = -SIZE / 2 + (ix * SIZE) / (RES - 1),
        z = -SIZE / 2 + (iz * SIZE) / (RES - 1),
        at = iz * RES + ix
      heights[at] = field.heightAt(x, z)
      field.splatAt(x, z).forEach((weight, layer) => {
        splat[at * 4 + layer] = Math.round(weight * 255)
      })
    }
  return new Uint8Array(buffer)
}
