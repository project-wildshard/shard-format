// oxlint-disable typescript/prefer-readonly-parameter-types -- byte parsers over typed arrays and DataViews, which have no readonly form; nothing here writes them
import { indexRecordingAac } from './aacIndex.ts'
import { looseAac } from './audio-mp4.ts'

import type { AudioShape } from './audio-mp4.ts'

// AUDIO AU5: measure one recording from its own bytes, with no decode and no
// ffmpeg. The strict playback index (`aacIndex.ts`) reads an admitted m4a; a
// plain box walk (`audio-mp4.ts`) reads an AAC file the index refuses (no
// `edts`, as six of Pine Hollow's beds); a RIFF walk reads PCM WAV. The bytes
// decide the container, never the URL: AU7's build keeps a source's URL, so a
// `.wav` or `.flac` URL can serve AAC. Any other container (FLAC, AIFF, Ogg,
// MP3, WebM, CAF, or bytes no sniff knows) still counts, and is unreadable.

/** What a recording is for: its URL says so (`/assets/music/` or `/assets/sfx/`). */
type RecordingRole = 'music' | 'sfx'

/** The container a recording's bytes are in, sniffed from its first bytes. */
type AudioContainer =
  | 'mp4'
  | 'wav'
  | 'flac'
  | 'aiff'
  | 'ogg'
  | 'mp3'
  | 'webm'
  | 'caf'
  | 'unknown'

/** One recording, measured from its own bytes. */
interface RecordingMeasure extends AudioShape {
  readonly url: string
  readonly hash: string
  readonly bytes: number
  readonly role: RecordingRole
  /** What the bytes are, whatever the URL's extension says. */
  readonly container: AudioContainer
  /** `aac` is AAC in mp4; `wav` is PCM WAV; `unreadable` is neither. */
  readonly codec: 'aac' | 'wav' | 'unreadable'
  /** Why the strict playback index refused it, when it did. */
  readonly reason?: string
}

type MeasureBase = Pick<
  RecordingMeasure,
  'url' | 'hash' | 'bytes' | 'role' | 'container'
>

interface WavFormat {
  readonly channels: number
  readonly rate: number
  readonly byteRate: number
}

const NONE = 0
const BITS = 8
const KBPS = 1000
const SAMPLE_RATE = 48_000
const TAG_BYTES = 4
const CHUNK_HEADER = 8
const RIFF_HEADER = 12
const WAV_CHANNELS = 2
const WAV_RATE = 4
const WAV_BYTE_RATE = 8
const WAV_BLOCK = 12
const WAV_FMT_MIN = 16
const PAD = 2
const FORM_TYPE = 8
const NEXT = 1
const MP3_SYNC = 255
const MP3_SYNC_HIGH = 224
const UTF16_BOM_LOW = 254
const UNKNOWN_REASON = 'bytes in no audio container AU5 knows; they still count'

const ROLE_PATTERN = /^\/assets\/(?<role>music|sfx)\//u
const AUDIO_EXTENSION =
  /\.(?:m4a|mp4|aac|wav|wave|flac|aif|aiff|aifc|caf|mp3|ogg|oga|opus|webm|weba)$/iu

/** Whether a public URL sits in an audio folder (`/assets/music/` or `/assets/sfx/`). */
function isAudioFolderUrl(url: string): boolean {
  return ROLE_PATTERN.test(url)
}

/** Whether a public URL names an audio file in an audio folder, by any audio extension. */
function isRecordingUrl(url: string): boolean {
  return isAudioFolderUrl(url) && AUDIO_EXTENSION.test(url)
}

function recordingRole(url: string): RecordingRole {
  return ROLE_PATTERN.exec(url)?.groups?.['role'] === 'music' ? 'music' : 'sfx'
}

function riffTag(raw: Uint8Array, at: number): string {
  return String.fromCodePoint(...raw.subarray(at, at + TAG_BYTES))
}

function isMp3(raw: Uint8Array): boolean {
  // An ID3 tag, or an MPEG audio (or ADTS) frame sync: byte 255, then 3 high
  // bits set, but not 255 254, a UTF-16 text file's byte-order mark.
  const second = raw[NEXT] ?? NONE
  return (
    riffTag(raw, NONE).startsWith('ID3') ||
    (raw[NONE] === MP3_SYNC &&
      second >= MP3_SYNC_HIGH &&
      second !== UTF16_BOM_LOW)
  )
}

/** First-four-byte magics; WebM's is the EBML header. */
const CONTAINER_TAGS: ReadonlyMap<string, AudioContainer> = new Map([
  ['fLaC', 'flac'],
  ['OggS', 'ogg'],
  ['caff', 'caf'],
  ['\u001AE\u00DF\u00A3', 'webm'],
])

/** RIFF and IFF files: the outer tag, then the form type at byte 8. */
const FORM_TAGS: ReadonlyMap<string, AudioContainer> = new Map([
  ['RIFF WAVE', 'wav'],
  ['FORM AIFF', 'aiff'],
  ['FORM AIFC', 'aiff'],
])

/** The container of a recording's bytes, from their magic numbers alone. */
function audioContainer(raw: Uint8Array): AudioContainer {
  const head = riffTag(raw, NONE)
  const form = FORM_TAGS.get(`${head} ${riffTag(raw, FORM_TYPE)}`)
  if (form !== undefined) {
    return form
  }
  if (riffTag(raw, TAG_BYTES) === 'ftyp') {
    return 'mp4'
  }
  return CONTAINER_TAGS.get(head) ?? (isMp3(raw) ? 'mp3' : 'unknown')
}

/** Whether a mounted file in an audio folder is a recording AU5 counts: an audio extension, or audio bytes. */
function isRecordingMount(url: string, raw: Uint8Array): boolean {
  return (
    isRecordingUrl(url) ||
    (isAudioFolderUrl(url) && audioContainer(raw) !== 'unknown')
  )
}

/** The `fmt ` fields; a byte rate that is not rate times block size reads as 0, so the file is unreadable. */
function wavFormat(view: DataView, body: number): WavFormat {
  const rate = view.getUint32(body + WAV_RATE, true)
  const byteRate = view.getUint32(body + WAV_BYTE_RATE, true)
  const block = view.getUint16(body + WAV_BLOCK, true)
  return {
    channels: view.getUint16(body + WAV_CHANNELS, true),
    rate,
    byteRate: byteRate === rate * block ? byteRate : NONE,
  }
}

function wavResult(
  format: Readonly<WavFormat>,
  size: number,
): AudioShape | undefined {
  if (format.byteRate === NONE) {
    return undefined
  }
  return {
    channels: format.channels,
    sampleRate: format.rate,
    seconds: size / format.byteRate,
    kbps: (format.byteRate * BITS) / KBPS,
  }
}

interface WavWalk {
  readonly raw: Uint8Array
  readonly view: DataView
  format: WavFormat | undefined
}

/** One RIFF chunk: the result when it is `data` after `fmt `, else the next chunk's offset. */
function wavChunk(walk: WavWalk, at: number): AudioShape | number {
  const size = walk.view.getUint32(at + TAG_BYTES, true)
  const body = at + CHUNK_HEADER
  const type = riffTag(walk.raw, at)
  if (
    type === 'fmt ' &&
    size >= WAV_FMT_MIN &&
    body + size <= walk.raw.length
  ) {
    walk.format = wavFormat(walk.view, body)
  }
  if (type === 'data' && walk.format !== undefined) {
    // An unreadable format ends the walk with no shape.
    return (
      wavResult(walk.format, Math.min(size, walk.raw.length - body)) ??
      walk.raw.length
    )
  }
  return body + size + (size % PAD)
}

/** The `fmt ` fields and `data` size of a RIFF WAVE file, or undefined. */
function wavShape(raw: Uint8Array): AudioShape | undefined {
  if (riffTag(raw, NONE) !== 'RIFF' || riffTag(raw, CHUNK_HEADER) !== 'WAVE') {
    return undefined
  }
  const walk: WavWalk = {
    raw,
    view: new DataView(raw.buffer, raw.byteOffset, raw.byteLength),
    format: undefined,
  }
  let at = RIFF_HEADER
  while (at + CHUNK_HEADER <= raw.length) {
    const next = wavChunk(walk, at)
    if (typeof next !== 'number') {
      return next
    }
    at = next
  }
  return undefined
}

function strictAac(raw: Uint8Array): AudioShape {
  const index = indexRecordingAac(raw)
  const total = index.sizes.reduce(
    (sum: number, size: number): number => sum + size,
    NONE,
  )
  const coded = index.mediaFrames / SAMPLE_RATE
  return {
    channels: index.channels,
    sampleRate: index.sampleRate,
    seconds: (index.mediaFrames - index.primingFrames) / SAMPLE_RATE,
    kbps: (total * BITS) / coded / KBPS,
  }
}

function unreadable(base: MeasureBase, reason: string): RecordingMeasure {
  const empty = { channels: NONE, sampleRate: NONE, seconds: NONE }
  return { ...base, ...empty, kbps: NONE, codec: 'unreadable', reason }
}

function aacMeasure(base: MeasureBase, raw: Uint8Array): RecordingMeasure {
  try {
    return { ...base, container: 'mp4', codec: 'aac', ...strictAac(raw) }
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error)
    const loose = looseAac(raw)
    return loose === undefined
      ? unreadable(base, reason)
      : { ...base, container: 'mp4', codec: 'aac', ...loose, reason }
  }
}

/** A recording whose bytes are not WAV: AAC in mp4, or a container AU5 does not read. */
function otherMeasure(base: MeasureBase, raw: Uint8Array): RecordingMeasure {
  if (base.container === 'mp4') {
    return aacMeasure(base, raw)
  }
  if (base.container === 'unknown') {
    // An mp4 with no leading `ftyp` may still read as AAC.
    const row = aacMeasure(base, raw)
    return row.codec === 'aac' ? row : unreadable(base, UNKNOWN_REASON)
  }
  const name = base.container.toUpperCase()
  return unreadable(
    base,
    `${name} bytes, not AAC in mp4 or WAV; they still count`,
  )
}

/** Measure one recording at `url` from its bytes: the bytes pick the container, not the URL's extension. */
function measureRecording(
  url: string,
  hash: string,
  raw: Uint8Array,
): RecordingMeasure {
  const container = audioContainer(raw)
  const role = recordingRole(url)
  const base = { url, hash, bytes: raw.length, role, container }
  if (container !== 'wav') {
    return otherMeasure(base, raw)
  }
  const wav = wavShape(raw)
  return wav === undefined
    ? unreadable(base, 'a RIFF WAVE file with no readable fmt and data')
    : { ...base, codec: 'wav', ...wav }
}

export type { AudioContainer, RecordingMeasure, RecordingRole }
export {
  audioContainer,
  isAudioFolderUrl,
  isRecordingMount,
  isRecordingUrl,
  measureRecording,
}
