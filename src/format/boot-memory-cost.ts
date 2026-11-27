import { controlFileHashes } from './admissionControl.ts'
import { textureMipBytes } from './contentBounds.ts'
import { contentBytes, gpuBytes, phoneInactiveFiles } from './phone-files.ts'
import { spawnViewSceneFiles } from './spawnView.ts'
import { parseImageAsset } from './stillImage.ts'
import { parseWorldScenes, worldScenesForTier } from './worldScenes.ts'

import type { PhoneFiles, TierIndex } from './phone-files.ts'
import type { Shardfile } from './shardSchema.ts'
import type { WorldScenesSection } from './worldScenes.ts'

interface BootMemoryCosts {
  readonly heldSpawnParts: number
  readonly largestDecode: number
  readonly shaderCompile: number
  readonly farSlabIndices: number
  readonly paintArrayGpu: number
  readonly paintArrayStaging: number
  /** MG6 epoch 4: the product's terms in EM11's phone chain (`phoneTerms`). */
  readonly terms?: PhoneTerms
  /** MG6 epoch 4: the phone playing (settled) estimate of `terms`. */
  readonly phonePlaying?: number
  /** MG6 epoch 4: the phone loading-peak estimate of `terms`. */
  readonly phoneFloor?: number
}

/** MG6 epoch 4: what the offline estimate reads of a product, in bytes; from epoch 5 only the files a phone fetches. */
interface PhoneTerms {
  /** Every phone-tier client file's wire bytes plus its CPU-decoded bytes (audio aside), the commons the same way, and,
   *  for a shard with no runtime, the decoded engine images the cook mounts: what a boot downloads and decodes. */
  readonly content: number
  /** GPU texture bytes: image and KTX2 files, commons GPU and mounted images; zero for a runtime home, whose `gl` stands
   *  in (its files carry every tier's variants: Pine ships 704 MB of texture bytes and holds 65 MB on a phone at Low). */
  readonly textures: number
  /** A runtime home's paired GL reading [L]; zero for a shard with no runtime. */
  readonly gl: number
  /** GPU geometry bytes: GLB and binary files. */
  readonly geometry: number
  /** The shard's own declared sim residency at its growth limit (`budgets.sim`, `serverBudget.memory`). */
  readonly sims: number
  /** A runtime home's paired Simulator WebContent + GL reading, whole; zero for a shard with no runtime. */
  readonly runtimeReading: number
}

const NO_BYTES = 0
/** No file left out, none left raw. */
const EVERY_FILE: Readonly<PhoneFiles> = { inactive: new Set() }
const TRIANGLE_CORNERS = 3
const INDEX_COPIES = 2
const FAR_SLAB_INDEX_SHARE = 0.75
const RGBA_BYTES = 4
const BASE_LEVEL = 1
// MG6: Nine's cold phone-tier shader step rose by 193 MB in the mini's
// Chromium capture (04d76bcf). The calibrated increment rounds to 168 MB.
const SHADER_COMPILE_BYTES = 168_000_000
const MB = 1_000_000
const ENGINE_PLAYING_BYTES = 601_226_000
const ENGINE_LOADING_BYTES = 880_443_000
/** MG6 epoch 8 (mini-pinemem5, 2026-11-18; epoch 7 mini-em11c, epoch 6 mini-sweep): the estimate is ENGINE-MEMORY EM11's phone chain (engine
 *  `scripts/memory/phone-model.json`, read without the Web Inspector's Network retention: native WebKit [K] of the
 *  WebContent and GPU processes through alpha or scale to an iPhone 17 Pro's WebContent, at the 2048 MiB ActiveHard line).
 *  The terms are the product's alone; the engine term and every weight are what one engine build does with them, so the
 *  estimate follows the engine only through a sweep and a refit: `memory-calibration.em11.json` names the build (engine
 *  `0af7ccd8`, 99 cold runs, 6 per heavy zone; epochs 6 and 7 read `50092092`), `memory-fit.mjs` fits this block from it and the golden pairs it. Each
 *  weight is phone bytes per product byte, fitted so that every pinned product's estimate is at or over the upper bound
 *  of EM11's error bar over its cold runs (engine `upperOverRuns`, the 90% prediction bound on one more cold boot;
 *  epoch 6 used the highest run's), with each verdict kept at the 1.0 GB playing envelope and the 1.5 GB loading
 *  line (epoch 8 exempts Nalati's loading verdict: EM11 now reads it under 1.5 GB, and keeping that verdict forced
 *  a 4.6x geometry weight that raised Nine's loading estimate by 260 MB; its estimate still falls 1,727 -> 1,582 MB). The fit is minimax, then least total overshoot; the content weight is held at 0.5 settled and 0.8 loading at
 *  least, so bytes a boot downloads and decodes always count. The terms count only the files a phone fetches
 *  (`phoneInactiveFiles`). Refit at every engine release, and after a memory cut that should reach the gates. */
const PHONE = {
  engine: { playing: ENGINE_PLAYING_BYTES, loading: ENGINE_LOADING_BYTES },
  content: { playing: 0.5, loading: 0.8 },
  textures: { playing: 2.1078, loading: 2.6827 },
  gl: { playing: 1.5515, loading: 1.7403 },
  geometry: { playing: 0, loading: 0 },
  /** A runtime home never reads under its own Simulator reading settled, nor under it times EM11's lowest peak over
   *  settled (1.257) while loading. No pinned home binds here today; it stops a heavy runtime with light files. */
  runtime: { playing: 1, loading: 1.26 },
} as const
const IMAGE_MOUNT = /\.(?:webp|png|jpe?g)$/u
const TEXTURE_KINDS: ReadonlySet<string> = new Set(['image', 'ktx2'])
const GEOMETRY_KINDS: ReadonlySet<string> = new Set(['glb', 'binary'])

function spawnMemoryCosts(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- format's shard row, only read
  shard: Shardfile,
  sections: ReadonlyMap<string, unknown>,
): Pick<BootMemoryCosts, 'heldSpawnParts' | 'largestDecode'> {
  const controls = new Set([
    ...controlFileHashes(shard),
    ...spawnViewSceneFiles(sections),
  ])
  let heldSpawnParts = Object.values(shard.requires.commonsWire).reduce(
    (sum, bytes): number => sum + bytes,
    NO_BYTES,
  )
  let largestDecode = NO_BYTES
  for (const file of shard.files) {
    if (controls.has(file.hash)) {
      heldSpawnParts += file.compressed
      largestDecode = Math.max(largestDecode, file.decoded)
    }
  }
  return { heldSpawnParts, largestDecode }
}

type SlabFile = Readonly<Pick<Shardfile['files'][number], 'hash' | 'triangles'>>

function farSlabBytes(
  files: readonly SlabFile[],
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- format's scene rows, only read
  scene: WorldScenesSection | undefined,
): number {
  const slabs = new Set<string>()
  for (const library of scene?.libraries ?? []) {
    if (library.kind === 'slabs') {
      for (const tile of library.tiles) {
        for (const file of tile.files) {
          slabs.add(file.file)
        }
      }
    }
  }
  // NB23: engine's slabLibrary reserves 75% more indices for the far levels.
  const triangles = files.reduce(
    (sum, file): number =>
      sum +
      (slabs.has(file.hash)
        ? Math.ceil(file.triangles * FAR_SLAB_INDEX_SHARE)
        : NO_BYTES),
    NO_BYTES,
  )
  return (
    triangles * TRIANGLE_CORNERS * Uint32Array.BYTES_PER_ELEMENT * INDEX_COPIES
  )
}

function paintArrayBytes(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- format's scene rows, only read
  scene: WorldScenesSection | undefined,
): Pick<BootMemoryCosts, 'paintArrayGpu' | 'paintArrayStaging'> {
  let paintArrayGpu = NO_BYTES
  let paintArrayStaging = NO_BYTES
  for (const row of scene?.lent ?? []) {
    if (row.kind === 'layers') {
      const edge = row.size.phone
      paintArrayGpu +=
        textureMipBytes(
          edge,
          edge,
          Math.floor(Math.log2(edge)) + BASE_LEVEL,
          false,
        ) * row.layers.length
      paintArrayStaging += edge * edge * RGBA_BYTES * row.layers.length
    }
  }
  return { paintArrayGpu, paintArrayStaging }
}

/** MG6 epoch 5: a product's terms without the `inactive` files. A runtime home's mounted images are left to its reading:
 *  a phone Low boot of Pine fetched none of its 99.6 MB of them (meta MEMORY-GATES, mini-pinemem2 `95a75759`). */
function phoneTerms(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- format's shard row, only read
  shard: Shardfile,
  mountedImages: number = NO_BYTES,
  files: Readonly<PhoneFiles> = EVERY_FILE,
): PhoneTerms {
  const cost = shard.runtime?.cost
  const commonsGpu = Object.values(shard.requires.commonsCosts).reduce(
    (sum, row): number => sum + row.gpu,
    NO_BYTES,
  )
  return {
    content: contentBytes(
      shard,
      cost === undefined ? mountedImages : NO_BYTES,
      files,
    ),
    textures:
      cost === undefined
        ? gpuBytes(shard, TEXTURE_KINDS, files) + commonsGpu + mountedImages
        : NO_BYTES,
    gl: cost === undefined ? NO_BYTES : Math.ceil(cost.glMB * MB),
    geometry: gpuBytes(shard, GEOMETRY_KINDS, files),
    sims: Math.max(shard.budgets.sim.resident, shard.serverBudget.memory),
    runtimeReading:
      cost === undefined
        ? NO_BYTES
        : Math.ceil((cost.webContentMB + cost.glMB) * MB),
  }
}

/** The decoded bytes of one mounted engine image the cook serves beside the product; zero for any other mount. A
 *  mount that does not parse as a still image is charged at its own size. */
function mountedImageBytes(path: string, bytes: Readonly<Uint8Array>): number {
  if (!IMAGE_MOUNT.test(path)) {
    return NO_BYTES
  }
  try {
    return parseImageAsset(bytes).decoded
  } catch {
    return bytes.length
  }
}

/** The phone loader substitutes a known `.phone.webp` mount for its desktop
 * image. A direct read in the prepared phone fence still counts. */
function mountedImageOnPhone(
  mount: Readonly<{ url: string; hash: string; keepImage?: boolean }>,
  urls: ReadonlySet<string>,
  phoneFence?: ReadonlySet<string>,
): boolean {
  if (
    phoneFence === undefined ||
    phoneFence.has(mount.hash) ||
    mount.keepImage === true
  ) {
    return true
  }
  const phone = mount.url.replace(/\.(?:png|jpg|webp)$/u, '.phone.webp')
  return phone === mount.url || !urls.has(phone)
}

/** MG6 epoch 4: the phone's playing (settled) and loading-peak estimates of a product's terms. */
function bootPhoneBytes(
  terms: Readonly<PhoneTerms>,
): Readonly<{ playing: number; loading: number }> {
  const phase = (kind: 'playing' | 'loading'): number =>
    Math.ceil(
      Math.max(
        PHONE.engine[kind] +
          PHONE.content[kind] * terms.content +
          PHONE.textures[kind] * terms.textures +
          PHONE.gl[kind] * terms.gl +
          PHONE.geometry[kind] * terms.geometry +
          terms.sims,
        PHONE.runtime[kind] * terms.runtimeReading,
      ),
    )
  const playing = phase('playing')
  return { playing, loading: Math.max(playing, phase('loading')) }
}

/** Boot memory outside the steady-state file and tile budgets. `product` carries what the caller has: the decoded size
 *  of the images the cook mounts (`mountedImageBytes`) and the output index, so the terms count only phone files. */
function bootMemoryCosts(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- format's shard row, only read
  shard: Shardfile,
  sections: ReadonlyMap<string, unknown>,
  product: Readonly<{
    mountedImages?: number
    index?: TierIndex | undefined
    /** SF25: the image files the cook leaves raw (`cookLeavesImageRaw`), charged decoded and as RGBA. */
    rawImages?: ReadonlySet<string> | undefined
  }> = {},
): BootMemoryCosts {
  const rawScene = sections.get('world/scenes')
  const scene =
    rawScene === undefined
      ? undefined
      : worldScenesForTier(parseWorldScenes(rawScene), 'phone')
  const terms = phoneTerms(shard, product.mountedImages ?? NO_BYTES, {
    inactive: phoneInactiveFiles(shard, product.index, sections),
    raw: product.rawImages,
  })
  const phone = bootPhoneBytes(terms)
  return {
    ...spawnMemoryCosts(shard, sections),
    shaderCompile: SHADER_COMPILE_BYTES,
    farSlabIndices: farSlabBytes(shard.files, scene),
    ...paintArrayBytes(scene),
    terms,
    phonePlaying: phone.playing,
    phoneFloor: phone.loading,
  }
}

export {
  type BootMemoryCosts,
  bootMemoryCosts,
  bootPhoneBytes,
  mountedImageBytes,
  mountedImageOnPhone,
  NO_BYTES,
  type PhoneTerms,
  phoneTerms,
}
