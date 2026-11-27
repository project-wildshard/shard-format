/* oxlint-disable curly, no-bitwise, typescript/explicit-function-return-type, typescript/no-unsafe-type-assertion, unicorn/number-literal-case, unicorn/numeric-separators-style -- one oracle per size: the phone file's mip chain written out beside the charges it checks; made-up headers in hex as their formats document them */
// SF25 (J525): the cook encodes the images it mounts, not only a shard's library images, so the estimate charges each
// encoded mount as the phone file the cook makes and leaves only what the cook leaves raw at its decoded RGBA: Nine
// Dragon 0.0.12 was refused at a 1.84 GB loading peak with 205 MB of mounted images charged as RGBA.
import { crc32, deflateSync } from 'node:zlib'

import { expect, test } from 'vitest'

import { phoneTerms } from './boot-memory-cost.ts'
import { cookedPhoneGpu } from './cooked-image-cost.ts'
import {
  cookedImageHead,
  cookEncodesMounts,
  cookLeavesImageRaw,
  mountedImagesCharge,
} from './cooked-mount-cost.ts'

import type { MountedImage } from './cooked-mount-cost.ts'
import type { Shardfile } from './shardSchema.ts'

/** The bytes of a phone file the cook encodes ASTC 6x6 at width by height: 16 bytes a 6x6 block down to 1x1. */
function astc6(width: number, height: number): number {
  let bytes = 0
  let levelHeight = height
  let levelWidth = width
  for (;;) {
    bytes += Math.ceil(levelWidth / 6) * Math.ceil(levelHeight / 6) * 16
    if (levelWidth === 1 && levelHeight === 1) return bytes
    levelWidth = Math.max(1, levelWidth >> 1)
    levelHeight = Math.max(1, levelHeight >> 1)
  }
}

const word = (value: number): number[] => {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value)
  return [...bytes]
}
const chunk = (type: string, data: readonly number[]): number[] => {
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
/** A JPEG's start and one baseline frame header: all the cook reads of its size. */
function jpeg(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0,
    17,
    8,
    height >> 8,
    height & 255,
    width >> 8,
    width & 255,
    3,
    ...Array.from({ length: 12 }, (): number => 0),
  ])
}
/** An extended WebP's canvas header. */
function webp(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(32)
  const view = new DataView(bytes.buffer)
  bytes.set(new TextEncoder().encode('RIFF'), 0)
  bytes.set(new TextEncoder().encode('WEBPVP8X'), 8)
  view.setUint32(24, (width - 1) & 0xffffff, true)
  view.setUint32(27, (height - 1) & 0xffffff, true)
  return bytes
}

test('reads the size the cook encodes an image at, and leaves an image off the 4x4 grid raw', () => {
  expect(cookedImageHead(png(64, 32))).toStrictEqual({ width: 64, height: 32 })
  expect(cookedImageHead(jpeg(2048, 1024))).toStrictEqual({
    width: 2048,
    height: 1024,
  })
  expect(cookedImageHead(webp(256, 128))).toStrictEqual({
    width: 256,
    height: 128,
  })
  expect(cookedImageHead(png(804, 1626))).toBeUndefined()
  expect(cookedImageHead(new Uint8Array([1, 2, 3, 4]))).toBeUndefined()
  expect(cookLeavesImageRaw(png(6, 6))).toBe(true)
  expect(cookLeavesImageRaw(png(8, 8))).toBe(false)
})

test('the cook encodes mounts only for a product whose cook names its discovery document', () => {
  expect(cookEncodesMounts([{ url: '/shardfiles/zone/discovery.json' }])).toBe(
    true,
  )
  expect(cookEncodesMounts([{ url: '/assets/zone/paint/wood.png' }])).toBe(
    false,
  )
})

const RAW = 1_000_000
const image = (
  url: string,
  head: readonly [number, number] | undefined,
  extra: Partial<MountedImage> = {},
): MountedImage => ({
  url,
  onPhone: true,
  raw: RAW,
  head: head === undefined ? undefined : { width: head[0], height: head[1] },
  ...extra,
})

test('an encoded mount charges its phone file at the phone size, kept at size for a sky', () => {
  // A plain row is trimmed to 512 on the phone; a sky, horizon or panorama keeps its size.
  expect(
    mountedImagesCharge(
      [image('/assets/zone/hdri/gain.png', [2048, 1024])],
      true,
    ),
  ).toBe(astc6(512, 256))
  expect(
    mountedImagesCharge(
      [image('/assets/zone/sky/dome.jpg', [2048, 1024])],
      true,
    ),
  ).toBe(astc6(2048, 1024))
  expect(
    mountedImagesCharge([image('/assets/zone/lab/leaf.png', [256, 256])], true),
  ).toBe(astc6(256, 256))
  // A ground layer file also gets its #layer twin, trimmed to the desktop's 1024 and kept at that on the phone.
  expect(
    mountedImagesCharge(
      [image('/assets/zone/tex/grass/diffuse.jpg', [2048, 2048])],
      true,
    ),
  ).toBe(astc6(512, 512) + astc6(1024, 1024))
})

test('a phone copy of an encoded mount charges nothing: the phone reads the original cooked', () => {
  const original = image('/assets/zone/paint/wood.png', [1024, 1024], {
    onPhone: false,
  })
  const copy = image('/assets/zone/paint/wood.phone.webp', [256, 256])
  expect(mountedImagesCharge([original, copy], true)).toBe(astc6(512, 512))
  // An original kept as an image leaves its copy what the phone reads, raw.
  expect(
    mountedImagesCharge([{ ...original, keepImage: true }, copy], true),
  ).toBe(RAW)
})

test('a mount the cook leaves raw keeps its decoded RGBA charge, and only where a phone reads it', () => {
  const kept = image('/assets/zone/ui/icon.png', [64, 64], { keepImage: true })
  const offGrid = image('/assets/zone/ui/portrait.jpg', undefined, {})
  const blob = image('/shardfiles/zone/blobs/image/a.jpg', [512, 512])
  const audio = image('/assets/zone/music/take.m4a', undefined, { raw: 0 })
  const desktop = image('/assets/zone/ui/odd.png', undefined, {
    onPhone: false,
  })
  expect(mountedImagesCharge([kept, offGrid, blob, audio, desktop], true)).toBe(
    3 * RAW,
  )
  // With no discovery document the cook encodes nothing: every phone mount is raw, as before SF25.
  expect(
    mountedImagesCharge(
      [image('/assets/zone/hdri/gain.png', [2048, 1024]), desktop],
      false,
    ),
  ).toBe(RAW)
})

const MB = 1_000_000
const hashOf = (digit: number): string => String(digit).repeat(64)
/** A shard of one image file of `gpu` RGBA bytes. */
function shard(gpu: number): Shardfile {
  return {
    identity: { slug: 'made-up' },
    files: [
      {
        hash: hashOf(1),
        kind: 'image',
        compressed: MB,
        decoded: gpu + 4 * MB,
        gpu,
        dependencies: [],
      },
    ],
    library: [hashOf(1)],
    critical: [],
    requires: { commonsWire: {}, commonsCosts: {} },
    budgets: { sim: { resident: 0 } },
    serverBudget: { memory: 0 },
  } as unknown as Shardfile
}

test('an image file the cook leaves raw charges decoded and RGBA in the phone terms; an encoded one its phone file', () => {
  const gpu = 1024 * 1024 * 4
  const cooked = phoneTerms(shard(gpu))
  expect(cooked.content).toBe(MB)
  expect(cooked.textures).toBe(cookedPhoneGpu(gpu))
  const raw = phoneTerms(shard(gpu), 0, {
    inactive: new Set(),
    raw: new Set([hashOf(1)]),
  })
  expect(raw.content).toBe(MB + gpu + 4 * MB)
  expect(raw.textures).toBe(gpu)
})
