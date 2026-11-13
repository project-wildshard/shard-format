import {
  isAudioFolderUrl,
  isRecordingMount,
  measureRecording,
} from './audio-measure.ts'
import { audioReport, isoDay } from './audio-rules.ts'

import type { RecordingMeasure } from './audio-measure.ts'
import type { AudioReport } from './audio-rules.ts'
import type { CookData, CookMount } from './cook-data.ts'
import type { OutputIndex } from './outputIndex.ts'
import type { Shardfile } from './shardSchema.ts'

// AUDIO AU5: a validated product's own recordings, and its report against the
// audio rules. Validation has already checked every byte's hash and size; this
// only measures. The recordings are the cook's audio mounts (`/assets/music`
// and `/assets/sfx`, under `mounts/` or in the blob they equal; any audio
// extension, or any audio bytes whatever the extension, so a `.flac` or `.aiff`
// counts and only non-audio files such as `music.json` don't) and the audio
// section's non-commons `recordings` blobs. Commons recordings are shared, so
// they are not the shard's own.

/** What `productRecordings` reads from a validated product. */
interface ProductAudioInput {
  readonly cook: CookData | undefined
  readonly read: (path: string, maxBytes: number) => Uint8Array
  readonly shard: Readonly<{
    audio: Readonly<Pick<Shardfile['audio'], 'recordings'>>
  }>
  readonly assets: ReadonlyMap<string, Uint8Array>
}

const COMMONS = 'commons:'

/** Every own recording in a validated product, measured from its bytes. */
function productRecordings(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- format's row types and a read port, only read
  input: Readonly<ProductAudioInput>,
): RecordingMeasure[] {
  const mounts = (input.cook?.mounts ?? [])
    .filter((mount: Readonly<CookMount>): boolean =>
      isAudioFolderUrl(mount.url),
    )
    .flatMap((mount: Readonly<CookMount>): RecordingMeasure[] => {
      const raw = input.read(mount.path, mount.bytes)
      return isRecordingMount(mount.url, raw)
        ? [measureRecording(mount.url, mount.hash, raw)]
        : []
    })
  const bound = Object.entries(input.shard.audio.recordings ?? {}).flatMap(
    ([url, ref]: readonly [string, string]): RecordingMeasure[] => {
      const bytes = ref.startsWith(COMMONS) ? undefined : input.assets.get(ref)
      return bytes === undefined ? [] : [measureRecording(url, ref, bytes)]
    },
  )
  return [...mounts, ...bound]
}

/** The product's audio against AU5's rules, its waiver read from `admission.audioWaiver`. A red report refuses only at
 *  upload (`assertAudioAdmission`); pack prints it. `today` decides whether the waiver is still in date. */
function productAudioReport(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- format's row types, only read
  product: Readonly<{ index: OutputIndex; audio: readonly RecordingMeasure[] }>,
  today: Readonly<Date>,
): AudioReport {
  const { identity, admission } = product.index
  return audioReport(product.audio, {
    slug: identity.slug,
    waiver: admission.audioWaiver,
    today: isoDay(today),
  })
}

export type { ProductAudioInput }
export { productAudioReport, productRecordings }
