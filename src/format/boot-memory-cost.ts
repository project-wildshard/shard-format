import { controlFileHashes } from './admissionControl.ts'
import { textureMipBytes } from './contentBounds.ts'
import { spawnViewSceneFiles } from './spawnView.ts'
import { parseImageAsset } from './stillImage.ts'
import { parseWorldScenes, worldScenesForTier } from './worldScenes.ts'

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

/** MG6 epoch 4: what the offline estimate reads of a product, in bytes. */
interface PhoneTerms {
  /** Every client file's wire bytes plus its CPU-decoded bytes (audio aside), the commons the same way, and the decoded
   *  engine images the cook mounts: what a boot downloads and decodes. */
  readonly content: number
  /** GPU texture bytes: image and KTX2 files, commons GPU and mounted images; zero for a runtime home, whose `gl` stands
   *  in (its files carry every tier's variants: Pine ships 704 MB of texture bytes and holds 65 MB on a phone at Low). */
  readonly textures: number
  /** A runtime home's paired GL reading [L]; zero for a data shard. */
  readonly gl: number
  /** GPU geometry bytes: GLB and binary files. */
  readonly geometry: number
  /** The shard's own declared sim residency at its growth limit (`budgets.sim`, `serverBudget.memory`). */
  readonly sims: number
  /** A runtime home's paired Simulator WebContent + GL reading, whole; zero for a data shard. */
  readonly runtimeReading: number
}

const NO_BYTES = 0
const TRIANGLE_CORNERS = 3
const INDEX_COPIES = 2
const FAR_SLAB_INDEX_SHARE = 0.75
const RGBA_BYTES = 4
const BASE_LEVEL = 1
// MG6: Nine's cold phone-tier shader step rose by 193 MB in the mini's
// Chromium capture (04d76bcf). The calibrated increment rounds to 168 MB.
const SHADER_COMPILE_BYTES = 168_000_000
const MB = 1_000_000
const ENGINE_PLAYING_BYTES = 710_000_000
const ENGINE_LOADING_BYTES = 910_000_000
/** MG6 epoch 4 (mini-estcal2, 2026-11-17): the estimate is ENGINE-MEMORY EM11's phone chain (engine
 *  `scripts/memory/phone-model.json`, refit at the 2048 MiB ActiveHard line in `72e30a23`: native WebKit [K] of the
 *  WebContent and GPU processes through alpha or scale to an iPhone 17 Pro's WebContent). It replaces epoch 3's
 *  Chromium renderer x2.0 and 2.5 x the Simulator reading, which put Pine at 2,276 MB against EM11's 1.5-1.7 GB. Each
 *  weight is phone bytes per product byte, fitted so that every pinned product's estimate is at or over the upper bound
 *  of EM11's error bar on its cold runs (engine `6b432a2a`, Mac mini, phone Low; `memory-calibration.golden.json` holds
 *  the pairs), with each verdict kept: a product EM11 puts under the 1.0 GB playing envelope or the 1.5 GB loading line
 *  stays under it here (Far Reach binds both). The fit is minimax, then least total overshoot; the content weight is held
 *  at 0.5 settled and 0.8 loading at least, so bytes a boot downloads and decodes always count (epoch 3: the renderer's
 *  ArrayBuffers stay at their peak after ready). The engine term is Template's bound raised to cover Sunscar Dunes,
 *  whose held bitmaps outweigh its terms; refit it when the engine's own boot gets cheaper. */
const PHONE = {
  engine: { playing: ENGINE_PLAYING_BYTES, loading: ENGINE_LOADING_BYTES },
  content: { playing: 0.5, loading: 0.8 },
  textures: { playing: 1.3, loading: 2.4 },
  gl: { playing: 1.5, loading: 1.4 },
  geometry: { playing: 0.2, loading: 2.6 },
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

/** MG6 epoch 3: what a boot downloads and decodes. Each client file's downloaded bytes, its CPU-decoded form (decoded
 *  audio is left out: a boot decodes only its sample set, and Nine and Open Plots decode none), the commons the same way,
 *  and the engine images the cook mounts (Far Reach's sky and terrain textures: 107 MB of decoded bitmaps measured
 *  against 105 MB charged). */
function contentBytes(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- format's shard row, only read
  shard: Shardfile,
  mountedImages: number,
): number {
  let bytes = mountedImages
  for (const file of shard.files) {
    bytes += file.compressed + (file.kind === 'audio' ? NO_BYTES : file.decoded)
  }
  for (const wire of Object.values(shard.requires.commonsWire)) {
    bytes += wire
  }
  for (const row of Object.values(shard.requires.commonsCosts)) {
    bytes += row.decoded
  }
  return bytes
}

/** The GPU bytes of the product's files of these kinds. */
function gpuBytes(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- format's shard row, only read
  shard: Shardfile,
  kinds: ReadonlySet<string>,
): number {
  let bytes = NO_BYTES
  for (const file of shard.files) {
    if (kinds.has(file.kind)) {
      bytes += file.gpu
    }
  }
  return bytes
}

/** MG6 epoch 4: a product's terms. */
function phoneTerms(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- format's shard row, only read
  shard: Shardfile,
  mountedImages: number = NO_BYTES,
): PhoneTerms {
  const cost = shard.runtime?.cost
  const commonsGpu = Object.values(shard.requires.commonsCosts).reduce(
    (sum, row): number => sum + row.gpu,
    NO_BYTES,
  )
  return {
    content: contentBytes(shard, mountedImages),
    textures:
      cost === undefined
        ? gpuBytes(shard, TEXTURE_KINDS) + commonsGpu + mountedImages
        : NO_BYTES,
    gl: cost === undefined ? NO_BYTES : Math.ceil(cost.glMB * MB),
    geometry: gpuBytes(shard, GEOMETRY_KINDS),
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

/** Boot memory that sits outside the steady-state file and tile budgets. `mountedImages` is the decoded size of the
 *  engine images the cook mounts (`mountedImageBytes`), when the caller has the product's mounts. */
function bootMemoryCosts(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- format's shard row, only read
  shard: Shardfile,
  sections: ReadonlyMap<string, unknown>,
  mountedImages: number = NO_BYTES,
): BootMemoryCosts {
  const rawScene = sections.get('world/scenes')
  const scene =
    rawScene === undefined
      ? undefined
      : worldScenesForTier(parseWorldScenes(rawScene), 'phone')
  const terms = phoneTerms(shard, mountedImages)
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
  NO_BYTES,
  type PhoneTerms,
  phoneTerms,
}
