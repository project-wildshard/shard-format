import type { Shardfile } from './shardSchema.ts'

/** STANDALONE-SHARDFILES SF5g (J525): a shardfile carries images only, and the cook encodes each texture image to the
 *  KTX2 a page reads in its place (blobKtx2), so the memory estimate charges an image as that KTX2. An image row holds no
 *  width or height, only `gpu`, its RGBA texels (`stillImage` envelope); textures are square or 2:1, so the size is read
 *  back from it, and any other count is charged as the square that holds it. Pine Hollow 0.0.18 was refused at a 1.67 GB
 *  phone peak counted as source RGBA, where its hand-made KTX2 sets (0.0.17) had been 1.31 GB. */

const RGBA_BYTES = 4
const WIDE = 2
const NO_BYTES = 0
const BLOCK_BYTES = 16
const BC_BLOCK = 4
const ASTC_PHONE_BLOCK = 6
const TEXEL = 1

interface Chain {
  readonly block: number
  readonly bytes: number
}
const RGBA_CHAIN: Chain = { block: TEXEL, bytes: RGBA_BYTES }
const BLOCK_CHAIN: Chain = { block: BC_BLOCK, bytes: BLOCK_BYTES }
const PHONE_CHAIN: Chain = { block: ASTC_PHONE_BLOCK, bytes: BLOCK_BYTES }

/** The width and height of an image whose RGBA texels cost `rgba`. */
function imageSize(rgba: number): readonly [number, number] {
  const texels = Math.ceil(rgba / RGBA_BYTES)
  const side = Math.round(Math.sqrt(texels))
  const wide = Math.round(Math.sqrt(texels * WIDE))
  if (side * side === texels) {
    return [side, side]
  }
  if (wide % WIDE === NO_BYTES && wide * (wide / WIDE) === texels) {
    return [wide, wide / WIDE]
  }
  const square = Math.ceil(Math.sqrt(texels))
  return [square, square]
}

/** A full mip chain's bytes from `width` by `height` down to 1x1, each level in the chain's blocks. */
function chainBytes(width: number, height: number, chain: Chain): number {
  let total = NO_BYTES
  let levelWidth = width
  let levelHeight = height
  for (;;) {
    total +=
      Math.ceil(levelWidth / chain.block) *
      Math.ceil(levelHeight / chain.block) *
      chain.bytes
    if (levelWidth === TEXEL && levelHeight === TEXEL) {
      return total
    }
    levelWidth = Math.max(TEXEL, Math.floor(levelWidth / WIDE))
    levelHeight = Math.max(TEXEL, Math.floor(levelHeight / WIDE))
  }
}

/** A full mip chain's bytes, each level in the chain's blocks (a block of one 4-byte texel for RGBA). */
function mipChainBytes(rgba: number, chain: Chain): number {
  const [width, height] = imageSize(rgba)
  return chainBytes(width, height, chain)
}

/** SF25: the GPU bytes of a phone file the cook encodes ASTC 6x6 at `width` by `height`, with its mip chain. */
function phoneChainBytes(width: number, height: number): number {
  return chainBytes(width, height, PHONE_CHAIN)
}

/** What a library image no longer charges once charged as the KTX2 the cook makes from it (`parseKtx2`): its decoded
 *  copy, and its GPU bytes become a full mip chain, RGBA without a transcode, 4x4 blocks of 16 bytes with one. */
function cookedImageSaving(
  file: Readonly<{ decoded: number; gpu: number }>,
  transcodes: boolean,
): number {
  const cooked = mipChainBytes(file.gpu, transcodes ? BLOCK_CHAIN : RGBA_CHAIN)
  return Math.max(NO_BYTES, file.decoded + file.gpu - cooked)
}

type ShardFile = Shardfile['files'][number]

/** The shard's files by hash. */
function filesByHash(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- format's shard row, only read
  source: Shardfile,
): Map<string, ShardFile> {
  const files = new Map<string, ShardFile>()
  for (const file of source.files) {
    files.set(file.hash, file)
  }
  return files
}

/** A file once: the first ask has it, later asks get none. */
function take(
  files: Map<string, ShardFile>,
  ref: string,
): ShardFile | undefined {
  const file = files.get(ref)
  files.delete(ref)
  return file
}

/** The library images the shard reaches, its library and their dependencies, each once. */
function libraryImages(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- format's shard row, only read
  source: Shardfile,
): ShardFile[] {
  const files = filesByHash(source)
  const pending = [...source.library]
  const images: ShardFile[] = []
  for (let ref = pending.pop(); ref !== undefined; ref = pending.pop()) {
    const file = take(files, ref)
    pending.push(...(file?.dependencies ?? []))
    if (file?.kind === 'image') {
      images.push(file)
    }
  }
  return images
}

/** The shard with every library image charged as the KTX2 the cook makes from it (`cookedImageSaving`, no transcode):
 *  what the offline memory lines and the validation receipt judge, as admission's `textureLibrarySource` does. SF25: an
 *  image the cook leaves raw (`rawImages`, off the 4x4 grid) keeps its decoded and RGBA charge. */
function cookedImageSource(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- format's shard row, only read
  source: Shardfile,
  rawImages: ReadonlySet<string> = new Set(),
): Shardfile {
  let saving = NO_BYTES
  for (const file of libraryImages(source)) {
    if (!rawImages.has(file.hash)) {
      saving += cookedImageSaving(file, false)
    }
  }
  if (saving === NO_BYTES) {
    return source
  }
  const { library } = source.budgets
  return {
    ...source,
    budgets: {
      ...source.budgets,
      library: {
        ...library,
        resident: Math.max(NO_BYTES, library.resident - saving),
      },
    },
  }
}

/** The GPU bytes of the phone file the cook makes from an image whose RGBA texels cost `rgba` (an image row's `gpu`):
 *  ASTC 6x6, 16 bytes a 6x6 block, with its mip chain. Charged at the image's own size, though the cook trims most phone
 *  rows to 512 (`phoneTierSize`): a ground layer or a sky keeps its size, and a row can't tell them apart. */
function cookedPhoneGpu(rgba: number): number {
  return mipChainBytes(rgba, PHONE_CHAIN)
}

export { cookedImageSaving, cookedImageSource, cookedPhoneGpu, phoneChainBytes }
