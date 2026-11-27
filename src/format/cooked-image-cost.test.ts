/* oxlint-disable curly, eslint/max-statements, no-bitwise, no-plusplus, sort-vars, typescript/explicit-function-return-type, typescript/no-unsafe-type-assertion, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls -- one oracle per size: the mip chain written out beside the counts it checks, on a minimal shard row */
// SF5g (J525): a shardfile carries images only and the cook encodes each texture image to the KTX2 a page reads, so the
// memory estimate charges a library image as that KTX2: Pine Hollow 0.0.18 was refused at 1.67 GB counted as source RGBA.
import { crc32, deflateSync } from 'node:zlib'

import { expect, test } from 'vitest'

import { textureMipBytes } from './contentBounds.ts'
import { cookedPhoneGpu } from './cooked-image-cost.ts'
import { textureLibrarySource } from './deviceMemoryCost.ts'
import { contentBytes, gpuBytes } from './phone-files.ts'
import { parseImageAsset } from './stillImage.ts'

import type { Shardfile } from './shardSchema.ts'

/** A big-endian 32-bit word. */
function word(value: number): number[] {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value)
  return [...bytes]
}
/** One PNG chunk with its checksum. */
function chunk(type: string, data: readonly number[]): number[] {
  const body = [...new TextEncoder().encode(type), ...data]
  return [...word(data.length), ...body, ...word(crc32(new Uint8Array(body)))]
}
/** A blank RGBA PNG. */
function png(width: number, height: number): Uint8Array {
  const rows = new Uint8Array((width * 4 + 1) * height)
  return new Uint8Array([
    137,
    80,
    78,
    71,
    13,
    10,
    26,
    10,
    ...chunk('IHDR', [...word(width), ...word(height), 8, 6, 0, 0, 0]),
    ...chunk('IDAT', [...deflateSync(rows)]),
    ...chunk('IEND', []),
  ])
}

interface Row {
  readonly hash: string
  readonly kind: string
  readonly decoded: number
  readonly gpu: number
}
/** A shard whose library is one file, its resident bytes that file's charge. */
function shard(row: Row): Shardfile {
  return {
    files: [{ ...row, compressed: 1, dependencies: [] }],
    library: [row.hash],
    budgets: { library: { resident: row.decoded + row.gpu, compressed: 1 } },
    requires: { commonsWire: {}, commonsCosts: {} },
  } as unknown as Shardfile
}
const resident = (source: Shardfile): number => source.budgets.library.resident

for (const [width, height] of [
  [1024, 1024],
  [512, 256],
  [64, 64],
] as const) {
  test(`a ${String(width)}x${String(height)} PNG charges what the KTX2 the cook makes from it charges`, () => {
    const image = parseImageAsset(png(width, height))
    const levels = Math.floor(Math.log2(Math.max(width, height))) + 1
    const rgba = textureMipBytes(width, height, levels, false),
      blocks = textureMipBytes(width, height, levels, true)
    const asImage = shard({
      hash: 'i',
      kind: 'image',
      decoded: image.decoded,
      gpu: image.gpu,
    })
    const asKtx2 = shard({ hash: 'k', kind: 'ktx2', decoded: 0, gpu: rgba })
    // Without a transcode the KTX2 uploads RGBA; the image now charges the same, not its decoded copy as well.
    expect(resident(textureLibrarySource(asImage, new Map()))).toBe(rgba)
    expect(resident(textureLibrarySource(asKtx2, new Map()))).toBe(rgba)
    // With ASTC or BC7 both upload one byte a texel.
    const astc = { astc: true, bc7: false },
      costs = new Map([['k', { rgba, astc: blocks, bc7: blocks }]])
    expect(resident(textureLibrarySource(asImage, new Map(), astc))).toBe(
      blocks,
    )
    expect(resident(textureLibrarySource(asKtx2, new Map(), astc, costs))).toBe(
      blocks,
    )
    // The phone estimate uploads the cook's ASTC 6x6 phone file, 16 bytes a 6x6 block down the chain, and decodes nothing.
    let astc6 = 0
    for (let level = 0; level < levels; level++)
      astc6 +=
        Math.ceil(Math.max(1, width >> level) / 6) *
        Math.ceil(Math.max(1, height >> level) / 6) *
        16
    expect(cookedPhoneGpu(image.gpu)).toBe(astc6)
    expect(contentBytes(asImage, 0, { inactive: new Set() })).toBe(1)
    expect(gpuBytes(asImage, new Set(['image']), { inactive: new Set() })).toBe(
      astc6,
    )
  })
}
