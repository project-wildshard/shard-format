// SF16 (J525): a shardfile carries images only, so its GLBs may hold core PNG or JPEG images bound by `source`; the cook
// encodes them to KTX2. External URIs, an image whose bytes differ from its MIME and an unknown MIME still refuse.
import { crc32, deflateSync } from 'node:zlib'

import { expect, test } from 'vitest'

import { glbImageCost } from './glbImages.ts'

// oxlint-disable typescript/prefer-readonly-parameter-types -- made-up glTF fixtures, only read

interface Image {
  readonly bytes: Uint8Array
  readonly mimeType: string
}
interface Glb {
  readonly binary: Uint8Array
  readonly doc: Record<string, unknown>
  readonly views: Record<string, unknown>[]
}

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
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]
const RGBA_EIGHT = [8, 6, 0, 0, 0]
/** A blank RGBA PNG of a square side. */
function png(side: number): Uint8Array {
  const rows = new Uint8Array((side * 4 + 1) * side)
  const head = chunk('IHDR', [...word(side), ...word(side), ...RGBA_EIGHT])
  return new Uint8Array([
    ...PNG_SIGNATURE,
    ...head,
    ...chunk('IDAT', [...deflateSync(rows)]),
    ...chunk('IEND', []),
  ])
}
/** A one-component baseline JPEG header and scan of a square side under 256. */
function jpeg(side: number): Uint8Array {
  const frame = [255, 192, 0, 11, 8, 0, side, 0, side, 1, 1, 17, 0]
  const scan = [255, 218, 0, 8, 1, 1, 0, 0, 63, 0, 18, 52]
  return new Uint8Array([255, 216, ...frame, ...scan, 255, 217])
}
/** A GLB's JSON, views and BIN with `images` packed in order and one material binding the first two textures. */
function glb(
  images: readonly Image[],
  textures: readonly Record<string, unknown>[],
): Glb {
  const views: Record<string, unknown>[] = []
  const parts: number[] = []
  for (const image of images) {
    views.push({
      buffer: 0,
      byteLength: image.bytes.length,
      byteOffset: parts.length,
    })
    parts.push(...image.bytes)
  }
  const normal = textures.length > 1 ? { normalTexture: { index: 1 } } : {}
  const doc = {
    images: images.map((image, at): Record<string, unknown> => ({
      bufferView: at,
      mimeType: image.mimeType,
    })),
    materials: [
      { pbrMetallicRoughness: { baseColorTexture: { index: 0 } }, ...normal },
    ],
    textures,
  }
  return { binary: new Uint8Array(parts), doc, views }
}
const cost =
  (file: Glb): (() => void) =>
  (): void => {
    glbImageCost(file.doc, file.views, file.binary)
  }
const BYTES_A_TEXEL = 4

test('admits core PNG and JPEG images bound by source and charges their mips', (): void => {
  const file = glb(
    [
      { bytes: png(8), mimeType: 'image/png' },
      { bytes: jpeg(16), mimeType: 'image/jpeg' },
    ],
    [{ source: 0 }, { source: 1 }],
  )
  const { decoded, gpu } = glbImageCost(file.doc, file.views, file.binary)
  expect(gpu).toBeGreaterThanOrEqual((8 * 8 + 16 * 16) * BYTES_A_TEXEL)
  expect(decoded).toBeGreaterThan(0)
})

test('still refuses an external image, a MIME that lies and an unknown MIME', (): void => {
  const external = glb(
    [{ bytes: png(4), mimeType: 'image/png' }],
    [{ source: 0 }],
  )
  const outside = {
    ...external,
    doc: { ...external.doc, images: [{ mimeType: 'image/png', uri: 'a.png' }] },
  }
  expect(cost(outside)).toThrow(/embedded PNG, JPEG/u)
  const lying = glb(
    [{ bytes: jpeg(4), mimeType: 'image/png' }],
    [{ source: 0 }],
  )
  expect(cost(lying)).toThrow(/MIME differs/u)
  const gif = glb([{ bytes: png(4), mimeType: 'image/gif' }], [{ source: 0 }])
  expect(cost(gif)).toThrow(/embedded PNG, JPEG/u)
})
