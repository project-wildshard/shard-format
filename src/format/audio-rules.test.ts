// oxlint-disable eslint/max-lines, eslint/no-bitwise, unicorn/max-nested-calls -- the m4a builder sits beside its tests, writes big-endian words and AAC config bits, and its boxes nest as the file does
import { parse } from 'valibot'
import { describe, expect, test } from 'vitest'

import {
  audioContainer,
  isRecordingMount,
  isRecordingUrl,
  measureRecording,
} from './audio-measure.ts'
import {
  AUDIO_RULES,
  assertAudioAdmission,
  audioReport,
  audioReportLines,
  isoDay,
} from './audio-rules.ts'
import { AudioWaiverSchema } from './audio-waiver.ts'
import { shardfileRecordings } from './shardfile-audio.ts'

import type { RecordingMeasure } from './audio-measure.ts'
import type { AudioFinding, AudioReport } from './audio-rules.ts'
import type { AudioWaiver } from './audio-waiver.ts'
import type { CookData, CookMount } from './cook-data.ts'

// AUDIO AU5: each rule, a waiver, and AMBER versus red. The m4a files are
// built here, box by box, in the one layout `aacIndex.ts` admits.

type Bytes = readonly number[]

interface M4aShape {
  readonly channels: 1 | 2
  readonly packets: number
  readonly packetBytes: number
  readonly edts?: boolean
  readonly headerChannels?: number
  /** The AAC object type in the decoder config; 2 is AAC-LC. */
  readonly profile?: number
  /** The `mdhd` duration, if not the packets' own. */
  readonly mdhdFrames?: number
}

const RATE = 48_000
const FRAMES = 1024
const FIXED = 65_536
const MB = 1_000_000
const TODAY = '2026-11-12'
const WAIVER: AudioWaiver = {
  shard: 'pine-hollow',
  until: '2026-12-31',
  maxBytes: 15 * MB,
  reason: 'AU10 re-encodes Pine',
}

function u32(value: number): Bytes {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ]
}

function u16(value: number): Bytes {
  return [(value >>> 8) & 255, value & 255]
}

function le32(value: number): Bytes {
  return u32(value).toReversed()
}

function le16(value: number): Bytes {
  return u16(value).toReversed()
}

function ascii(text: string): Bytes {
  return Array.from(
    { length: text.length },
    (_unused: unknown, index: number): number => text.codePointAt(index) ?? 0,
  )
}

function zeros(length: number): Bytes {
  return Array.from({ length }, (): number => 0)
}

function box(type: string, ...parts: readonly Bytes[]): Bytes {
  const body = parts.flat()
  return [...u32(body.length + 8), ...ascii(type), ...body]
}

function full(type: string, ...parts: readonly Bytes[]): Bytes {
  return box(type, [0, 0, 0, 0], ...parts)
}

function sampleEntry(shape: Readonly<M4aShape>): Bytes {
  const asc = [((shape.profile ?? 2) << 3) | 1, 0x80 | (shape.channels << 3)]
  const decoder = [4, 17, 0x40, 0x15, 0, 0, 0, ...u32(0), ...u32(0), 5, 2]
  const esds = full('esds', [3, 22], u16(1), [0], decoder, asc)
  const header = [...zeros(6), ...u16(1), ...zeros(8)]
  const channels = u16(shape.headerChannels ?? shape.channels)
  const format = [...u16(16), ...u16(0), ...u16(0), ...u32(RATE * FIXED)]
  return box('mp4a', header, channels, format, esds)
}

function sampleTable(shape: Readonly<M4aShape>, offset: number): Bytes {
  const sizes = Array.from({ length: shape.packets }, (): Bytes =>
    u32(shape.packetBytes),
  )
  return box(
    'stbl',
    full('stsd', u32(1), sampleEntry(shape)),
    full('stts', u32(1), u32(shape.packets), u32(FRAMES)),
    full('stsc', u32(1), u32(1), u32(shape.packets), u32(1)),
    full('stsz', u32(0), u32(shape.packets), ...sizes),
    full('stco', u32(1), u32(offset)),
  )
}

function movie(shape: Readonly<M4aShape>, offset: number): Bytes {
  const frames = shape.packets * FRAMES
  const edit = full(
    'elst',
    u32(1),
    u32(frames - FRAMES),
    u32(FRAMES),
    u32(FIXED),
  )
  const media = box(
    'mdia',
    full(
      'mdhd',
      u32(0),
      u32(0),
      u32(RATE),
      u32(shape.mdhdFrames ?? frames),
      u32(0),
    ),
    full('hdlr', u32(0), ascii('soun'), zeros(12), [0]),
    box('minf', sampleTable(shape, offset)),
  )
  const edts = shape.edts === false ? [] : [box('edts', edit)]
  return box('moov', box('trak', ...edts, media))
}

/** A minimal AAC-LC 48 kHz m4a: one track, one chunk, packets of 1024 frames. */
function m4a(shape: Readonly<M4aShape>): Uint8Array {
  const ftyp = box('ftyp', ascii('M4A '), u32(0), ascii('M4A '))
  const offset = ftyp.length + movie(shape, 0).length + 8
  const mdat = box('mdat', zeros(shape.packets * shape.packetBytes))
  return new Uint8Array([...ftyp, ...movie(shape, offset), ...mdat])
}

/** A mono 16-bit PCM WAV of `seconds` at `rate`. */
function wav(rate: number, seconds: number): Uint8Array {
  const data = rate * 2 * seconds
  const format = [...le16(1), ...le16(1), ...le32(rate), ...le32(rate * 2)]
  return new Uint8Array([
    ...ascii('RIFF'),
    ...le32(36 + data),
    ...ascii('WAVEfmt '),
    ...le32(16),
    ...format,
    ...le16(2),
    ...le16(16),
    ...ascii('data'),
    ...le32(data),
    ...zeros(data),
  ])
}

function row(bytes: number, hash: string): RecordingMeasure {
  const url = `/assets/sfx/x/${hash}.m4a`
  const shape = { channels: 1, sampleRate: RATE, seconds: 1, kbps: 32 }
  return {
    url,
    hash,
    bytes,
    role: 'sfx',
    container: 'mp4',
    codec: 'aac',
    ...shape,
  }
}

function alone(recording: Readonly<RecordingMeasure>): AudioReport {
  return audioReport([recording], {
    slug: 's',
    waiver: undefined,
    today: TODAY,
  })
}

function music(packetBytes: number): RecordingMeasure {
  const bytes = m4a({ channels: 2, packets: 200, packetBytes })
  return measureRecording('/assets/music/a/t.m4a', 'm', bytes)
}

function sfx(channels: 1 | 2, packetBytes: number): readonly AudioFinding[] {
  const bytes = m4a({ channels, packets: 50, packetBytes })
  return alone(measureRecording('/assets/sfx/a/s.m4a', 'x', bytes)).findings
}

function rules(report: Readonly<AudioReport>): string[] {
  return report.findings.map(
    (finding: Readonly<AudioFinding>): string => finding.rule,
  )
}

describe('measure', (): void => {
  test('reads bitrate, channels, rate and duration from the m4a boxes', (): void => {
    // 160-byte packets of 1024 frames at 48 kHz are 60 kbps.
    const bytes = m4a({ channels: 2, packets: 470, packetBytes: 160 })
    const measured = measureRecording('/assets/music/a/title.m4a', 'h', bytes)
    expect(measured).toMatchObject({ codec: 'aac', role: 'music', channels: 2 })
    expect(measured.sampleRate).toBe(RATE)
    expect(measured.kbps).toBeCloseTo(60, 9)
    expect(measured.seconds).toBeCloseTo((469 * FRAMES) / RATE, 9)
    expect(measured.reason).toBeUndefined()
  })
  test('an AAC file the strict index refuses (no edts) is still measured', (): void => {
    // Channels come from the decoder config, not the sample entry's header:
    // Pine's beds say 2 there and are mono.
    const shape = { channels: 1, packets: 100, packetBytes: 128 } as const
    const bytes = m4a({ ...shape, edts: false, headerChannels: 2 })
    const measured = measureRecording('/assets/sfx/a/bed.m4a', 'h', bytes)
    expect(measured).toMatchObject({ codec: 'aac', channels: 1, kbps: 48 })
    expect(measured.reason).toMatch(/edts/u)
  })
  test('PCM WAV and unreadable bytes', (): void => {
    const measured = measureRecording('/assets/sfx/a/b.wav', 'h', wav(8000, 1))
    expect(measured).toMatchObject({
      codec: 'wav',
      sampleRate: 8000,
      kbps: 128,
    })
    expect(measured.seconds).toBe(1)
    const junk = measureRecording(
      '/assets/sfx/a/c.m4a',
      'h',
      new Uint8Array(64),
    )
    expect(junk.codec).toBe('unreadable')
  })
  test('only /assets/music and /assets/sfx audio files count', (): void => {
    expect(isRecordingUrl('/assets/music/piano/title-3d1f713a.m4a')).toBe(true)
    expect(isRecordingUrl('/assets/sfx/best/hit.wav')).toBe(true)
    expect(isRecordingUrl('/assets/music/a/bed.flac')).toBe(true)
    expect(isRecordingUrl('/assets/sfx/a/hit.aiff')).toBe(true)
    expect(isRecordingUrl('/assets/sfx/a/hit.AIF')).toBe(true)
    expect(isRecordingUrl('/assets/music/coral-drift/music.json')).toBe(false)
    expect(isRecordingUrl('/assets/baked/x.m4a')).toBe(false)
  })
})

/** The bytes with the `stsz` packet count overwritten. */
function forgedCount(bytes: Readonly<Uint8Array>, count: number): Uint8Array {
  const copy = new Uint8Array(bytes)
  const at = Buffer.from(copy).indexOf('stsz') - 4
  copy.set(u32(count), at + 16)
  return copy
}

describe('untrusted bytes off the strict index', (): void => {
  const loose = { channels: 1, edts: false } as const
  test('an AAC file outside the strict index is AMBER', (): void => {
    const bytes = m4a({ ...loose, packets: 100, packetBytes: 100 })
    const report = alone(measureRecording('/assets/sfx/a/b.m4a', 'h', bytes))
    expect(report.level).toBe('amber')
    expect(rules(report)).toEqual(['format'])
  })
  test('a forged mdhd duration cannot hide length', (): void => {
    const shape = { ...loose, packets: 8500, packetBytes: 8, mdhdFrames: 0 }
    const bytes = m4a(shape)
    const report = alone(measureRecording('/assets/sfx/a/b.m4a', 'h', bytes))
    expect(rules(report)).toEqual(['format', 'duration'])
    expect(report.level).toBe('red')
  })
  test('a forged packet count is bounded by the file', (): void => {
    const bytes = forgedCount(
      m4a({ ...loose, packets: 10, packetBytes: 8 }),
      4_294_967_295,
    )
    const measured = measureRecording('/assets/sfx/a/b.m4a', 'h', bytes)
    expect(measured.codec).toBe('aac')
    expect(measured.seconds).toBeLessThan(1)
  })
  test('HE-AAC and a WAV whose byte rate lies are red', (): void => {
    const he = m4a({ ...loose, packets: 10, packetBytes: 8, profile: 5 })
    expect(alone(measureRecording('/assets/sfx/a/b.m4a', 'h', he)).level).toBe(
      'red',
    )
    const lying = wav(8000, 1)
    lying.set(u32(1).toReversed(), 28)
    expect(
      alone(measureRecording('/assets/sfx/a/c.wav', 'w', lying)).level,
    ).toBe('red')
  })
})

describe('per-file rules', (): void => {
  test('bitrate caps by role and channels, each +10%', (): void => {
    expect(AUDIO_RULES.kbps).toEqual({
      music: { mono: 48, stereo: 64 },
      sfx: { mono: 40, stereo: 48 },
    })
    // Kbps is 0.375 times the packet bytes: 187 is 70.1, under 70.4.
    expect(alone(music(187)).level).toBe('green')
    expect(alone(music(188)).level).toBe('amber')
    expect(rules(alone(music(188)))).toEqual(['bitrate'])
    expect(sfx(1, 117)).toEqual([])
    expect(sfx(1, 118)).toHaveLength(1)
    expect(sfx(2, 140)).toEqual([])
    expect(sfx(2, 141)).toHaveLength(1)
  })
  test('over 180 s is red', (): void => {
    const long = m4a({ channels: 1, packets: 8500, packetBytes: 8 })
    const report = alone(measureRecording('/assets/music/a/l.m4a', 'l', long))
    expect(report.level).toBe('red')
    expect(rules(report)).toEqual(['duration'])
    const fits = m4a({ channels: 1, packets: 8400, packetBytes: 8 })
    const ok = alone(measureRecording('/assets/music/a/o.m4a', 'o', fits))
    expect(ok.level).toBe('green')
  })
  test('format: WAV is AMBER, unreadable bytes are red', (): void => {
    const pcm = alone(
      measureRecording('/assets/sfx/a/b.wav', 'w', wav(8000, 1)),
    )
    expect(pcm.level).toBe('amber')
    expect(rules(pcm)).toEqual(['format'])
    const junk = new Uint8Array(64)
    const bad = alone(measureRecording('/assets/sfx/a/c.m4a', 'u', junk))
    expect(bad.level).toBe('red')
  })
})

describe('budget: AMBER versus red', (): void => {
  test('green to 6 MB, AMBER over it; one hash counts once', (): void => {
    const none = { slug: 's', waiver: undefined, today: TODAY }
    expect(audioReport([row(6 * MB, 'a')], none).level).toBe('green')
    const rows = [row(5 * MB, 'a'), row(3 * MB, 'b'), row(3 * MB, 'b')]
    const amber = audioReport(rows, none)
    expect(amber).toMatchObject({ level: 'amber', files: 2, bytes: 8 * MB })
    expect((): void => {
      assertAudioAdmission(amber)
    }).not.toThrow()
  })
  test('red over 10 MB, and admission refuses it', (): void => {
    const none = { slug: 's', waiver: undefined, today: TODAY }
    const red = audioReport([row(6 * MB, 'a'), row(5 * MB, 'b')], none)
    expect(red.level).toBe('red')
    expect((): void => {
      assertAudioAdmission(red)
    }).toThrow(/Audio rules \(AU5\) refuse s: s holds 11\.00 MB/u)
  })
  test('pack prints AMBER with the numbers, even for a red', (): void => {
    const none = { slug: 'pine-hollow', waiver: undefined, today: TODAY }
    const report = audioReport([row(14_658_913, 'a')], none)
    expect(audioReportLines(report)).toEqual([
      'audio AMBER: pine-hollow 1 recordings, 14.66 MB (AMBER over 6.00 MB, red over 10.00 MB)',
      'AMBER audio budget: pine-hollow holds 14.66 MB of its own audio, over the 10.00 MB red line (red: api-server refuses this at upload)',
    ])
  })
})

describe('the dated waiver', (): void => {
  const pine = [row(14_658_913, 'a')]
  test('turns red into AMBER through its last day', (): void => {
    const held = audioReport(pine, {
      slug: 'pine-hollow',
      waiver: WAIVER,
      today: TODAY,
    })
    expect(held.level).toBe('amber')
    expect(held.findings[0]?.message).toMatch(/waived until 2026-12-31/u)
    expect((): void => {
      assertAudioAdmission(held)
    }).not.toThrow()
    const last = { slug: 'pine-hollow', waiver: WAIVER, today: '2026-12-31' }
    expect(audioReport(pine, last).level).toBe('amber')
  })
  test.each([
    ['expired', { slug: 'pine-hollow', waiver: WAIVER, today: '2027-01-01' }],
    ['for another shard', { slug: 'nalati', waiver: WAIVER, today: TODAY }],
    [
      'outgrown',
      {
        slug: 'pine-hollow',
        waiver: { ...WAIVER, maxBytes: 14 * MB },
        today: TODAY,
      },
    ],
  ] as const)('does not hold when %s', (_why: string, budget): void => {
    const report = audioReport(pine, budget)
    expect(report.level).toBe('red')
    expect(rules(report)).toEqual(['waiver', 'budget'])
    expect((): void => {
      assertAudioAdmission(report)
    }).toThrow(/AU5/u)
  })
  test('the schema wants a slug, a date, bytes and a reason', (): void => {
    expect(parse(AudioWaiverSchema, WAIVER)).toEqual(WAIVER)
    expect((): unknown =>
      parse(AudioWaiverSchema, { ...WAIVER, until: 'soon' }),
    ).toThrow()
    expect((): unknown =>
      parse(AudioWaiverSchema, { ...WAIVER, reason: '' }),
    ).toThrow()
    expect((): unknown =>
      parse(AudioWaiverSchema, { ...WAIVER, more: 1 }),
    ).toThrow()
    expect(isoDay(new Date('2026-11-12T23:30:00Z'))).toBe(TODAY)
  })
})

/** A FLAC file's head: the magic and a STREAMINFO block, then padding. */
function flac(length: number): Uint8Array {
  return new Uint8Array([...ascii('fLaC'), 0x80, 0, 0, 34, ...zeros(length)])
}

/** An AIFF file's head: FORM, its size and AIFF, then a COMM chunk's room. */
function aiff(length: number): Uint8Array {
  return new Uint8Array([
    ...ascii('FORM'),
    ...u32(length + 4),
    ...ascii('AIFF'),
    ...zeros(length),
  ])
}

function codes(report: Readonly<AudioReport>): string[] {
  return report.findings.map(
    (finding: Readonly<AudioFinding>): string => finding.code,
  )
}

const NONE_WAIVED = { slug: 's', waiver: undefined, today: TODAY }

function sniff(bytes: readonly number[]): string {
  return audioContainer(new Uint8Array(bytes))
}

describe('every audio file counts, whatever its extension', (): void => {
  const none = NONE_WAIVED
  test('a flac and an aiff count toward the cap, and say their container', (): void => {
    const big = 6 * MB
    const rows = [
      measureRecording('/assets/music/a/bed.flac', 'f', flac(big)),
      measureRecording('/assets/sfx/a/hit.aiff', 'a', aiff(big)),
    ]
    expect(rows.map((one): string => one.container)).toEqual(['flac', 'aiff'])
    const report = audioReport(rows, none)
    expect(report.files).toBe(2)
    expect(report.bytes).toBe(big * 2 + 8 + 12)
    expect(report.level).toBe('red')
    expect(codes(report)).toEqual([
      'audio-budget-red',
      'audio-container',
      'audio-container',
    ])
    expect(report.findings[1]?.message).toMatch(/bed\.flac .*\(FLAC bytes/u)
  })
  test('a .wav URL holding AAC bytes is measured as AAC (AU7 keeps the URL)', (): void => {
    const bytes = m4a({ channels: 1, packets: 100, packetBytes: 100 })
    const measured = measureRecording('/assets/sfx/a/hit.wav', 'h', bytes)
    expect(measured).toMatchObject({ container: 'mp4', codec: 'aac' })
    expect(measured.kbps).toBeCloseTo(37.5, 9)
    expect(alone(measured).level).toBe('green')
    const flacUrl = measureRecording('/assets/music/a/bed.flac', 'm', bytes)
    expect(alone(flacUrl).level).toBe('green')
  })
  test('an unknown container gets audio-container', (): void => {
    const junk = new Uint8Array(64).fill(7)
    const report = alone(measureRecording('/assets/sfx/a/x.flac', 'u', junk))
    expect(report.recordings[0]?.container).toBe('unknown')
    expect(codes(report)).toEqual(['audio-container'])
    expect(report.findings[0]?.message).toMatch(/no audio container AU5 knows/u)
    expect(report.level).toBe('red')
    const ogg = new Uint8Array([...ascii('OggS'), ...zeros(60)])
    expect(
      codes(alone(measureRecording('/assets/sfx/a/x.ogg', 'o', ogg))),
    ).toEqual(['audio-container'])
  })
})

describe('containers', (): void => {
  test('a broken m4a or WAV stays audio-unreadable', (): void => {
    const he = m4a({ channels: 1, packets: 10, packetBytes: 8, profile: 5 })
    expect(
      codes(alone(measureRecording('/assets/sfx/a/b.m4a', 'h', he))),
    ).toEqual(['audio-unreadable'])
  })
  test('the container sniff', (): void => {
    expect(sniff([...ascii('ID3'), 4, 0])).toBe('mp3')
    expect(sniff([255, 251, 144, 0])).toBe('mp3')
    expect(sniff([26, 69, 223, 163, 0])).toBe('webm')
    expect(sniff([...ascii('caff'), 0, 1])).toBe('caf')
    expect(sniff([...ascii('FORM'), ...u32(4), ...ascii('AIFC')])).toBe('aiff')
    expect(sniff([...ascii('{"a":1}')])).toBe('unknown')
    expect(sniff([255, 254, 123, 0])).toBe('unknown')
    expect(sniff([])).toBe('unknown')
  })
})

/** A product mounting an m4a, a flac, two aiffs, a music.json and a `.wav` URL of AAC bytes. */
function mountedProduct(): { rows: RecordingMeasure[]; expected: number } {
  const files = new Map<string, Uint8Array>([
    ['mounts/a.m4a', m4a({ channels: 1, packets: 10, packetBytes: 8 })],
    ['mounts/b.flac', flac(100)],
    ['mounts/c.aiff', aiff(100)],
    ['mounts/d.aif', aiff(50)],
    ['mounts/e.json', new Uint8Array(ascii('{}'))],
    ['mounts/f.wav', m4a({ channels: 1, packets: 20, packetBytes: 8 })],
  ])
  const urls = [
    '/assets/music/a/a.m4a',
    '/assets/music/a/b.flac',
    '/assets/sfx/a/c.aiff',
    '/assets/sfx/a/d.aif',
    '/assets/music/a/music.json',
    '/assets/sfx/a/f.wav',
  ]
  const paths = [...files.keys()]
  const cook: CookData = {
    version: 1,
    mounts: urls.map((url: string, at: number): CookMount => {
      const path = paths[at] ?? ''
      return { url, path, hash: path, bytes: files.get(path)?.length ?? 0 }
    }),
  }
  const rows = shardfileRecordings({
    cook,
    read: (path: string): Uint8Array => files.get(path) ?? new Uint8Array(),
    shard: { audio: {} },
    assets: new Map(),
  })
  let expected = 0
  for (const path of paths.filter(
    (one: string): boolean => !one.endsWith('.json'),
  )) {
    expected += files.get(path)?.length ?? 0
  }
  return { rows, expected }
}

describe('audio mounts', (): void => {
  test('a mount in an audio folder counts by audio extension or audio bytes', (): void => {
    const json = new Uint8Array(ascii('{"tracks":[]}'))
    expect(isRecordingMount('/assets/music/a/music.json', json)).toBe(false)
    expect(isRecordingMount('/assets/sfx/a/hit.bin', flac(8))).toBe(true)
    expect(isRecordingMount('/assets/sfx/a/hit.flac', json)).toBe(true)
    expect(isRecordingMount('/assets/baked/a/hit.flac', flac(8))).toBe(false)
  })
  test('shardfileRecordings measures every audio mount, and skips music.json', (): void => {
    const { rows, expected } = mountedProduct()
    expect(rows.map((one): string => `${one.url} ${one.container}`)).toEqual([
      '/assets/music/a/a.m4a mp4',
      '/assets/music/a/b.flac flac',
      '/assets/sfx/a/c.aiff aiff',
      '/assets/sfx/a/d.aif aiff',
      '/assets/sfx/a/f.wav mp4',
    ])
    expect(audioReport(rows, NONE_WAIVED).bytes).toBe(expected)
  })
})
