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
  /** MG6 epoch 3: the boot's CPU side as the phone-tier probe's renderer holds it (boot-phone.ts). */
  readonly renderer?: number
  /** MG6 epoch 3: a runtime home's paired Simulator WebContent + GL reading, whole (not less its pre-entry set). */
  readonly runtimeReading?: number
  /** MG6 epoch 3: `bootPhoneBytes` of the two above, the floor the loading estimate never goes under. */
  readonly phoneFloor?: number
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
/** MG6 epoch 3 (mini-estcal, 2026-11-17): the phone-tier probe's loading renderer on an empty product (Ink Cel, Pastel,
 *  Template, Open Plots read 368-424 MB on the v0.1.36 client, engine probe `3cd2dd87`), rounded up to cover Brasscap
 *  and Sunscar. Lower it when the engine's own boot gets cheaper (mini-ninemem2). */
const RENDERER_FLOOR_BYTES = 420_000_000
const MB = 1_000_000
/** MG6 epoch 3: the phone is the probe's loading renderer x2.0 (engine `3cd2dd87`, the floor from Jake's v0.1.36
 *  iPhone crash). */
const PHONE_PER_RENDERER = 2
/** MG6 epoch 3: the probe's phone over a runtime home's paired Simulator WebContent + GL reading. Nalati 2,239 / 904 MB
 *  = 2.48, Pine 2,076 / 850 MB = 2.44 (Driftwood 2.12; Nine's reading is stale). */
const PHONE_PER_RUNTIME_READING = 2.5
const IMAGE_MOUNT = /\.(?:webp|png|jpe?g)$/u

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

/** MG6 epoch 3: what the probe's renderer holds at the boot peak beyond its empty-product floor. Each client file's
 *  downloaded bytes, its CPU-decoded form (decoded audio is left out: a boot decodes only its sample set, and Nine and
 *  Open Plots decode none), the commons the same way, and the engine images the cook mounts (Far Reach's sky and
 *  terrain textures: 107 MB of decoded bitmaps measured against 105 MB charged). */
function rendererBytes(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- format's shard row, only read
  shard: Shardfile,
  mountedImages: number,
): number {
  let bytes = RENDERER_FLOOR_BYTES + mountedImages
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

/** MG6 epoch 3: a runtime home's paired reading, whole. */
function runtimeReadingBytes(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- format's shard row, only read
  shard: Shardfile,
): number {
  const cost = shard.runtime?.cost
  return cost === undefined
    ? NO_BYTES
    : Math.ceil((cost.webContentMB + cost.glMB) * MB)
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

/** MG6 epoch 3: the boot's phone floor, from the renderer side and from a runtime home's own reading. */
function bootPhoneBytes(
  boot: Readonly<Pick<BootMemoryCosts, 'renderer' | 'runtimeReading'>>,
): number {
  return Math.ceil(
    Math.max(
      PHONE_PER_RENDERER * (boot.renderer ?? NO_BYTES),
      PHONE_PER_RUNTIME_READING * (boot.runtimeReading ?? NO_BYTES),
    ),
  )
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
  const renderer = rendererBytes(shard, mountedImages)
  const runtimeReading = runtimeReadingBytes(shard)
  return {
    ...spawnMemoryCosts(shard, sections),
    shaderCompile: SHADER_COMPILE_BYTES,
    farSlabIndices: farSlabBytes(shard.files, scene),
    ...paintArrayBytes(scene),
    renderer,
    runtimeReading,
    phoneFloor: bootPhoneBytes({ renderer, runtimeReading }),
  }
}

export {
  type BootMemoryCosts,
  bootMemoryCosts,
  bootPhoneBytes,
  mountedImageBytes,
  NO_BYTES,
  RENDERER_FLOOR_BYTES,
}
