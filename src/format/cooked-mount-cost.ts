/* oxlint-disable no-bitwise, no-magic-numbers, unicorn/number-literal-case, unicorn/numeric-separators-style -- the PNG, JPEG and WebP header offsets, signatures and masks engine's imageHead reads, written as it writes them */
import { phoneChainBytes } from './cooked-image-cost.ts'

/** STANDALONE-SHARDFILES SF25 (J525): the cook encodes the images it mounts too, not only a shard's library images (SF5g).
 *  Engine's cook (`desktopKtx2`, `cookedKtx2.ts`) makes a KTX2 of every `/assets/` PNG, JPEG or WebP mount on the 4x4
 *  block grid, unless its row keeps it an image (`keepImage`) or it is a `.phone`/`-phone` copy, and its phone pass
 *  (`phoneTier`, `tierTextures.ts`) cooks the phone's ASTC 6x6 file from that KTX2 at the phone's size; the phone's table
 *  points a phone copy's URL at its original's file. So the estimate charges an encoded mount as that phone file, a phone
 *  copy of one nothing, and a mount the cook leaves raw as before: decoded and on the GPU as RGBA (`mountedImageBytes`).
 *  Nine Dragon 0.0.12 was refused at a 1.84 GB loading peak with its 205 MB of mounted images charged as RGBA. The cook
 *  encodes only for a product whose cook names its discovery document, as engine's `shardHalf` does. */

/** An image's size from its header (engine `imageHead`): a PNG's IHDR, a WebP's VP8, VP8L or VP8X chunk, or a JPEG's
 *  first frame marker. Undefined for anything else. */
interface ImageHead {
  readonly width: number
  readonly height: number
}

const NO_BYTES = 0
const BLOCK = 4
const PNG_HEAD = 24
const WEBP_HEAD = 31
const JPEG_START = 2
const JPEG_FRAME = 9
const JPEG_MARK = 0xff
const SOF_FIRST = 0xc0
const SOF_LAST = 0xcf
// DHT, JPG and DAC sit inside the frame-marker range but hold no frame.
const NOT_FRAMES: ReadonlySet<number> = new Set([0xc4, 0xc8, 0xcc])
const WEBP_LOSSY = 0x56503820
const WEBP_LOSSLESS = 0x5650384c
const WEBP_EXTENDED = 0x56503858
const VP8_START = [0x9d, 0x01, 0x2a] as const
const VP8L_SIGNATURE = 0x2f
const BITS_14 = 0x3fff
const BITS_24 = 0xffffff
const ONE = 1
/** Engine `PHONE_TIER_MAX`: the phone's file of a plain row keeps no level above 512. */
const PHONE_TIER_MAX = 512
/** Engine `KEPT_ENCODE_MAX`: a row kept at its size (a sky, a horizon, a panorama, a `#layer` twin). */
const KEPT_MAX = 16_384
/** Engine `DESKTOP_LAYER_MAX`: a ground layer's `#layer` twin keeps no level above the desktop's array size. */
const DESKTOP_LAYER_MAX = 1024
const PHONE_COPY = /[.-]phone\.[a-z0-9]+$/iu
const IMAGE_FILE = /\.(?:jpe?g|png|webp)$/iu
const LAYER_FILE =
  /\/tex\/[^/]+\/(?:diffuse|nor_gl|arm)(?:_1k)?\.(?:jpe?g|png)$/iu
const KEPT_SIZE = /\/(?:horizon|sky)\/|\/panorama[.-][^/]*$/u
const DISCOVERY = /^\/shardfiles\/[^/]+\/discovery\.json$/u

function webpHead(
  bytes: Readonly<Uint8Array>,
  view: DataView,
): ImageHead | undefined {
  const chunk = view.getUint32(12)
  if (
    chunk === WEBP_LOSSY &&
    VP8_START.every((byte, at): boolean => bytes[23 + at] === byte)
  ) {
    return {
      width: view.getUint16(26, true) & BITS_14,
      height: view.getUint16(28, true) & BITS_14,
    }
  }
  if (chunk === WEBP_LOSSLESS && bytes[20] === VP8L_SIGNATURE) {
    const bits = view.getUint32(21, true)
    return {
      width: (bits & BITS_14) + ONE,
      height: ((bits >>> 14) & BITS_14) + ONE,
    }
  }
  if (chunk === WEBP_EXTENDED) {
    return {
      width: (view.getUint32(24, true) & BITS_24) + ONE,
      height: (view.getUint32(27, true) & BITS_24) + ONE,
    }
  }
  return undefined
}

function jpegHead(
  bytes: Readonly<Uint8Array>,
  view: DataView,
): ImageHead | undefined {
  let at = JPEG_START
  while (at + JPEG_FRAME < bytes.length) {
    if (bytes[at] !== JPEG_MARK) {
      return undefined
    }
    const marker = bytes[at + ONE] ?? NO_BYTES
    if (marker >= SOF_FIRST && marker <= SOF_LAST && !NOT_FRAMES.has(marker)) {
      return { width: view.getUint16(at + 7), height: view.getUint16(at + 5) }
    }
    at += JPEG_START + view.getUint16(at + 2)
  }
  return undefined
}

/** The image's width and height from its header alone, at any wire size, as the cook reads it. */
function imageHead(bytes: Readonly<Uint8Array>): ImageHead | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (
    bytes.length >= PNG_HEAD &&
    view.getUint32(0) === 0x89504e47 &&
    view.getUint32(4) === 0x0d0a1a0a
  ) {
    return { width: view.getUint32(16), height: view.getUint32(20) }
  }
  if (
    bytes.length >= WEBP_HEAD &&
    view.getUint32(0) === 0x52494646 &&
    view.getUint32(8) === 0x57454250
  ) {
    return webpHead(bytes, view)
  }
  if (bytes.length < BLOCK || bytes[0] !== JPEG_MARK || bytes[1] !== 0xd8) {
    return undefined
  }
  return jpegHead(bytes, view)
}

/** The size the cook encodes an image at, or undefined when it leaves the image raw: a block format's top level is whole
 *  4x4 blocks, so an image off that grid (or one whose header can't be read) stays an image (`encodedBlob`, `desktopKtx2`). */
function cookedImageHead(bytes: Readonly<Uint8Array>): ImageHead | undefined {
  const head = imageHead(bytes)
  return head === undefined ||
    head.width % BLOCK !== NO_BYTES ||
    head.height % BLOCK !== NO_BYTES
    ? undefined
    : head
}

/** Whether the cook leaves a product image file as it is (`blobKtx2` encodes every other one, SF16). */
function cookLeavesImageRaw(bytes: Readonly<Uint8Array>): boolean {
  return cookedImageHead(bytes) === undefined
}

/** A KTX2's top level once engine's `trimKtx2` drops every level whose larger side is over `max`. */
function trimmed(head: ImageHead, max: number): ImageHead {
  let { width, height } = head
  while (Math.max(width, height) > max && (width > ONE || height > ONE)) {
    width = Math.max(ONE, Math.floor(width / 2))
    height = Math.max(ONE, Math.floor(height / 2))
  }
  return { width, height }
}

/** The bytes of the phone files the cook makes from an encoded mount: its ASTC 6x6 file at the phone's size (`phoneTierSize`:
 *  512, a sky, horizon or panorama at its own), and for a ground layer file also its `#layer` twin's, trimmed to the
 *  desktop's array size and kept at it. A phone file's wire is at most its GPU bytes, so both terms charge them. */
function cookedMountBytes(url: string, head: ImageHead): number {
  const plain = trimmed(head, KEPT_SIZE.test(url) ? KEPT_MAX : PHONE_TIER_MAX)
  let bytes = phoneChainBytes(plain.width, plain.height)
  if (LAYER_FILE.test(url)) {
    const layer = trimmed(head, DESKTOP_LAYER_MAX)
    bytes += phoneChainBytes(layer.width, layer.height)
  }
  return bytes
}

/** One image mount as the estimate reads it: its row, whether a phone reads it (`mountedImageOnPhone`), what it charges
 *  raw (`mountedImageBytes`) and the size the cook encodes it at (`cookedImageHead`). */
interface MountedImage {
  readonly url: string
  readonly keepImage?: true
  readonly onPhone: boolean
  readonly raw: number
  readonly head: ImageHead | undefined
}

/** Whether the product's cook encodes its mounts: engine's cook does when the cook names the discovery document. */
function cookEncodesMounts(
  mounts: readonly Readonly<{ url: string }>[],
): boolean {
  return mounts.some((mount): boolean => DISCOVERY.test(mount.url))
}

function encodes(image: Readonly<MountedImage>): boolean {
  return (
    image.keepImage !== true &&
    image.url.startsWith('/assets/') &&
    !PHONE_COPY.test(image.url) &&
    IMAGE_FILE.test(image.url) &&
    image.head !== undefined
  )
}

/** A phone copy's original, as the cook pairs them (`phoneServed`): the copy's name without its `.phone` or `-phone`
 *  mark, with any image extension. */
function originalOf(
  copy: string,
  encoded: ReadonlyMap<string, MountedImage>,
): MountedImage | undefined {
  const stem = copy.replace(PHONE_COPY, '')
  for (const [url, image] of encoded) {
    if (url.slice(0, url.lastIndexOf('.')) === stem) {
      return image
    }
  }
  return undefined
}

/** What a product's mounted images charge the phone estimate: each mount the cook encodes as its phone files, whichever
 *  of it or its phone copy the phone asks for; a phone copy of an encoded mount nothing (the phone's table reads the
 *  original's file in its place); any other mount its raw charge when a phone reads it. */
function mountedImagesCharge(
  images: readonly Readonly<MountedImage>[],
  cooks: boolean,
): number {
  const encoded = new Map<string, MountedImage>()
  for (const image of cooks ? images : []) {
    if (encodes(image)) {
      encoded.set(image.url, image)
    }
  }
  let bytes = NO_BYTES
  for (const image of images) {
    if (image.head !== undefined && encoded.has(image.url)) {
      bytes += cookedMountBytes(image.url, image.head)
    } else if (
      image.onPhone &&
      !(
        PHONE_COPY.test(image.url) &&
        originalOf(image.url, encoded) !== undefined
      )
    ) {
      bytes += image.raw
    }
  }
  return bytes
}

export {
  cookedImageHead,
  cookedMountBytes,
  cookEncodesMounts,
  cookLeavesImageRaw,
  type ImageHead,
  type MountedImage,
  mountedImagesCharge,
}
