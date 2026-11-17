import { controlFileHashes } from './admissionControl.ts'
import { textureMipBytes } from './contentBounds.ts'
import { spawnViewSceneFiles } from './spawnView.ts'
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

/** Boot memory that sits outside the steady-state file and tile budgets. */
function bootMemoryCosts(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- format's shard row, only read
  shard: Shardfile,
  sections: ReadonlyMap<string, unknown>,
): BootMemoryCosts {
  const rawScene = sections.get('world/scenes')
  const scene =
    rawScene === undefined
      ? undefined
      : worldScenesForTier(parseWorldScenes(rawScene), 'phone')
  return {
    ...spawnMemoryCosts(shard, sections),
    shaderCompile: SHADER_COMPILE_BYTES,
    farSlabIndices: farSlabBytes(shard.files, scene),
    ...paintArrayBytes(scene),
  }
}

export { type BootMemoryCosts, bootMemoryCosts }
