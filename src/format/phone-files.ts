// MEMORY-GATES MG6 epoch 5 (mini-em11b): the files a phone never fetches, for the offline estimate's terms.
import { cookedPhoneGpu } from './cooked-image-cost.ts'
import { tierLibrarySteps } from './tierSelection.ts'

import type { Shardfile } from './shardSchema.ts'
import type { TierSelectionSource } from './tierSelection.ts'

const NO_BYTES = 0

/** The output index rows tier selection reads: the assembled Shardfile drops each file's `tier` and `variantOf`. */
interface TierIndex {
  readonly files: readonly Readonly<{
    hash: string
    path: string
    name?: string
    tier?: 'phone' | 'desktop'
    variantOf?: string
    compressed?: number
  }>[]
}

/** The files a phone never fetches, by tier selection's own verdict (the selection boot compilation runs): the desktop
 *  tier's named files, the texture-mode alternatives a phone skips, the other tier's horizons and scene models. Empty
 *  when the caller has no output index, so the estimate then counts every file. */
function phoneInactiveFiles(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- tier selection's source, only read
  source: TierSelectionSource,
  index: TierIndex | undefined,
  sections: ReadonlyMap<string, unknown>,
): ReadonlySet<string> {
  if (index === undefined) {
    return new Set()
  }
  const steps = tierLibrarySteps(source, 'phone', { index, sections })
  let step = steps.next()
  while (step.done !== true) {
    step = steps.next()
  }
  return step.value
}

/** MG6 epoch 3: what a boot downloads and decodes. Each client file's downloaded bytes, its CPU-decoded form (decoded
 *  audio is left out: a boot decodes only its sample set, and Nine and Open Plots decode none), the commons the same way,
 *  and the engine images the cook mounts (Far Reach's sky and terrain textures: 107 MB of decoded bitmaps measured
 *  against 105 MB charged). */
function contentBytes(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- format's shard row, only read
  shard: Shardfile,
  mountedImages: number,
  inactive: ReadonlySet<string>,
): number {
  let bytes = mountedImages
  for (const file of shard.files) {
    if (!inactive.has(file.hash)) {
      // SF5g (J525): the cook encodes an image to the KTX2 a phone uploads, so the phone never decodes it.
      bytes +=
        file.compressed +
        (file.kind === 'audio' || file.kind === 'image'
          ? NO_BYTES
          : file.decoded)
    }
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
  inactive: ReadonlySet<string>,
): number {
  let bytes = NO_BYTES
  for (const file of shard.files) {
    if (kinds.has(file.kind) && !inactive.has(file.hash)) {
      // SF5g (J525): an image uploads as the cook's phone ASTC 6x6 file, not as RGBA.
      bytes += file.kind === 'image' ? cookedPhoneGpu(file.gpu) : file.gpu
    }
  }
  return bytes
}

export { contentBytes, gpuBytes, phoneInactiveFiles, type TierIndex }
