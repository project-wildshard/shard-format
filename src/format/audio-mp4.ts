// oxlint-disable typescript/prefer-readonly-parameter-types -- byte parsers over typed arrays and DataViews, which have no readonly form; nothing here writes them
// AUDIO AU5: a plain mp4 read for an AAC file the strict playback index
// (`aacIndex.ts`) refuses, such as one with no `edts`. It reads only what the
// audio rules need: the media duration (`mdhd`), the `mp4a` entry's channels
// (from its AAC decoder config) and sample rate, and the packet bytes (`stsz`).

/** What AU5 measures of a recording. */
interface AudioShape {
  readonly channels: number
  readonly sampleRate: number
  readonly seconds: number
  readonly kbps: number
}

interface Bytes {
  readonly view: DataView
  readonly raw: Uint8Array
}

interface BoxRange {
  readonly start: number
  readonly end: number
  readonly depth: number
}

const NONE = 0
const NEXT = 1
const BITS = 8
const KBPS = 1000
const TAG_BYTES = 4
const WORD = 4
const BOX_HEADER = 8
const FULL_BOX = 12
const BOX_DEPTH = 6
const CONTAINERS: ReadonlySet<string> = new Set([
  'moov',
  'trak',
  'mdia',
  'minf',
  'stbl',
])
const STSD_ENTRY = 16
const MP4A_CHANNELS = 24
const MP4A_RATE = 32
const ESDS_AT = 36
const MDHD_V1 = 1
const MDHD_V0_SCALE = 20
const MDHD_V1_SCALE = 28
const STSZ_COUNT = 16
const STSZ_SIZES = 20
const FIXED_POINT = 65_536
const DESCRIPTOR_LENGTH_BYTES = 4
const DECODER_FIELDS = 13
const MORE = 128
const ES_DESCRIPTOR = 3
const ES_FLAGS = 2
const ES_FIELDS = 3
const DECODER_CONFIG = 4
const DECODER_SPECIFIC = 5
const CHANNEL_DIVISOR = 8
const CHANNEL_VALUES = 16

function tagAt(source: Readonly<Bytes>, at: number): string {
  if (at + TAG_BYTES > source.raw.length) {
    return ''
  }
  return String.fromCodePoint(...source.raw.subarray(at, at + TAG_BYTES))
}

function u32(source: Readonly<Bytes>, at: number): number {
  return at + WORD <= source.raw.length ? source.view.getUint32(at) : NONE
}

/** The body offset of descriptor `kind` at `at` (MPEG-4 expandable length), or undefined. */
function descriptorBody(
  source: Readonly<Bytes>,
  at: number,
  kind: number,
): number | undefined {
  if (source.raw[at] !== kind) {
    return undefined
  }
  for (let step = NEXT; step <= DESCRIPTOR_LENGTH_BYTES; step += NEXT) {
    const value = source.raw[at + step]
    if (value === undefined) {
      return undefined
    }
    if (value < MORE) {
      return at + step + NEXT
    }
  }
  return undefined
}

/** The channel configuration in an `mp4a` entry's AAC decoder config, or undefined. */
function configuredChannels(
  source: Readonly<Bytes>,
  sample: number,
): number | undefined {
  const esds = sample + ESDS_AT
  if (tagAt(source, esds + TAG_BYTES) !== 'esds') {
    return undefined
  }
  const es = descriptorBody(source, esds + FULL_BOX, ES_DESCRIPTOR)
  if (es === undefined || source.raw[es + ES_FLAGS] !== NONE) {
    return undefined
  }
  const decoder = descriptorBody(source, es + ES_FIELDS, DECODER_CONFIG)
  const specific =
    decoder === undefined
      ? undefined
      : descriptorBody(source, decoder + DECODER_FIELDS, DECODER_SPECIFIC)
  const second =
    specific === undefined ? undefined : source.raw[specific + NEXT]
  return second === undefined
    ? undefined
    : Math.floor(second / CHANNEL_DIVISOR) % CHANNEL_VALUES
}

/** The first offset of each box type, walking only the sample-table path. */
function findBoxes(
  source: Readonly<Bytes>,
  range: Readonly<BoxRange>,
  found: Map<string, number>,
): void {
  let at = range.start
  let size = u32(source, at)
  while (size >= BOX_HEADER && at + size <= range.end) {
    const type = tagAt(source, at + TAG_BYTES)
    found.set(type, found.get(type) ?? at)
    if (CONTAINERS.has(type) && range.depth < BOX_DEPTH) {
      const inner = { start: at + BOX_HEADER, end: at + size }
      findBoxes(source, { ...inner, depth: range.depth + NEXT }, found)
    }
    at += size
    size = u32(source, at)
  }
}

/** Media duration in seconds from `mdhd`, version 0 or 1. */
function mediaSeconds(source: Readonly<Bytes>, mdhd: number): number {
  const v1 = source.raw[mdhd + BOX_HEADER] === MDHD_V1
  const scaleAt = mdhd + (v1 ? MDHD_V1_SCALE : MDHD_V0_SCALE)
  const scale = u32(source, scaleAt)
  const high = v1 ? u32(source, scaleAt + WORD) : NONE
  const low = u32(source, scaleAt + (v1 ? WORD + WORD : WORD))
  const frames = high * FIXED_POINT * FIXED_POINT + low
  return scale === NONE ? NONE : frames / scale
}

/** Every packet's bytes from `stsz`. */
function packetBytes(source: Readonly<Bytes>, stsz: number): number {
  const fixed = u32(source, stsz + FULL_BOX)
  const count = u32(source, stsz + STSZ_COUNT)
  if (fixed !== NONE) {
    return fixed * count
  }
  let total = NONE
  for (let index = NONE; index < count; index += NEXT) {
    total += u32(source, stsz + STSZ_SIZES + index * WORD)
  }
  return total
}

function shapeOf(
  source: Readonly<Bytes>,
  boxes: Readonly<{ mdhd: number; sample: number; stsz: number }>,
): AudioShape {
  const seconds = mediaSeconds(source, boxes.mdhd)
  const bits = packetBytes(source, boxes.stsz) * BITS
  const header = source.view.getUint16(boxes.sample + MP4A_CHANNELS)
  return {
    channels: configuredChannels(source, boxes.sample) ?? header,
    sampleRate: Math.floor(u32(source, boxes.sample + MP4A_RATE) / FIXED_POINT),
    seconds,
    kbps: seconds === NONE ? NONE : bits / seconds / KBPS,
  }
}

/** The `mdhd`, `mp4a` entry and `stsz` offsets, or undefined when a box is missing. */
function trackBoxes(
  source: Readonly<Bytes>,
): Readonly<{ mdhd: number; sample: number; stsz: number }> | undefined {
  const found = new Map<string, number>()
  findBoxes(source, { start: NONE, end: source.raw.length, depth: NONE }, found)
  const [mdhd, stsd, stsz] = ['mdhd', 'stsd', 'stsz'].map(
    (type: string): number | undefined => found.get(type),
  )
  if (mdhd === undefined || stsd === undefined || stsz === undefined) {
    return undefined
  }
  const sample = stsd + STSD_ENTRY
  const fits = sample + MP4A_RATE + WORD <= source.raw.length
  if (!fits || tagAt(source, sample + TAG_BYTES) !== 'mp4a') {
    return undefined
  }
  return { mdhd, sample, stsz }
}

/** A plain mp4 read of an AAC recording, or undefined when it has no `mp4a` track. */
function looseAac(raw: Uint8Array): AudioShape | undefined {
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
  const source = { view, raw }
  const boxes = trackBoxes(source)
  return boxes === undefined ? undefined : shapeOf(source, boxes)
}

export type { AudioShape }
export { looseAac }
