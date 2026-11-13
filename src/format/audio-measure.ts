// oxlint-disable typescript/prefer-readonly-parameter-types -- byte parsers over typed arrays and DataViews, which have no readonly form; nothing here writes them
import { indexRecordingAac } from './aacIndex.ts'
import { looseAac } from './audio-mp4.ts'

import type { AudioShape } from './audio-mp4.ts'

// AUDIO AU5: measure one recording from its own bytes, with no decode and no
// ffmpeg. The strict playback index (`aacIndex.ts`) reads an admitted m4a; a
// plain box walk (`audio-mp4.ts`) reads an AAC file the index refuses (no
// `edts`, as six of Pine Hollow's beds); a RIFF walk reads PCM WAV.

/** What a recording is for: its URL says so (`/assets/music/` or `/assets/sfx/`). */
type RecordingRole = 'music' | 'sfx'

/** One recording, measured from its own bytes. */
interface RecordingMeasure extends AudioShape {
  readonly url: string
  readonly hash: string
  readonly bytes: number
  readonly role: RecordingRole
  /** `aac` is AAC in mp4; `wav` is PCM WAV; `unreadable` is neither. */
  readonly codec: 'aac' | 'wav' | 'unreadable'
  /** Why the strict playback index refused it, when it did. */
  readonly reason?: string
}

type MeasureBase = Pick<RecordingMeasure, 'url' | 'hash' | 'bytes' | 'role'>

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
const WAV_FMT_MIN = 16
const PAD = 2

const ROLE_PATTERN = /^\/assets\/(?<role>music|sfx)\//u
const RECORDING_PATTERN = /^\/assets\/(?:music|sfx)\/.+\.(?:m4a|wav)$/u

/** Whether a public URL is a recording AU5 counts. */
function isRecordingUrl(url: string): boolean {
  return RECORDING_PATTERN.test(url)
}

function recordingRole(url: string): RecordingRole {
  return ROLE_PATTERN.exec(url)?.groups?.['role'] === 'music' ? 'music' : 'sfx'
}

function riffTag(raw: Uint8Array, at: number): string {
  return String.fromCodePoint(...raw.subarray(at, at + TAG_BYTES))
}

function wavFormat(view: DataView, body: number): WavFormat {
  return {
    channels: view.getUint16(body + WAV_CHANNELS, true),
    rate: view.getUint32(body + WAV_RATE, true),
    byteRate: view.getUint32(body + WAV_BYTE_RATE, true),
  }
}

function wavResult(format: Readonly<WavFormat>, size: number): AudioShape {
  const seconds = format.byteRate === NONE ? NONE : size / format.byteRate
  return {
    channels: format.channels,
    sampleRate: format.rate,
    seconds,
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
    return wavResult(walk.format, size)
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

function aacMeasure(base: MeasureBase, raw: Uint8Array): RecordingMeasure {
  try {
    return { ...base, codec: 'aac', ...strictAac(raw) }
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error)
    const loose = looseAac(raw)
    if (loose === undefined) {
      const empty = { channels: NONE, sampleRate: NONE, seconds: NONE }
      return { ...base, ...empty, kbps: NONE, codec: 'unreadable', reason }
    }
    return { ...base, codec: 'aac', ...loose, reason }
  }
}

/** Measure one recording at `url` from its bytes. */
function measureRecording(
  url: string,
  hash: string,
  raw: Uint8Array,
): RecordingMeasure {
  const base = { url, hash, bytes: raw.length, role: recordingRole(url) }
  const wav = wavShape(raw)
  return wav === undefined
    ? aacMeasure(base, raw)
    : { ...base, codec: 'wav', ...wav }
}

export type { RecordingMeasure, RecordingRole }
export { isRecordingUrl, measureRecording }
