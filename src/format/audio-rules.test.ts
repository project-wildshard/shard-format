// oxlint-disable eslint/max-lines, eslint/no-bitwise, unicorn/max-nested-calls -- the m4a builder sits beside its tests, writes big-endian words and AAC config bits, and its boxes nest as the file does
import { parse } from 'valibot'
import { describe, expect, test } from 'vitest'

import { isRecordingUrl, measureRecording } from './audio-measure.ts'
import {
  AUDIO_RULES,
  assertAudioAdmission,
  audioReport,
  audioReportLines,
  isoDay,
} from './audio-rules.ts'
import { AudioWaiverSchema } from './audio-waiver.ts'

import type { RecordingMeasure } from './audio-measure.ts'
import type { AudioFinding, AudioReport } from './audio-rules.ts'
import type { AudioWaiver } from './audio-waiver.ts'

// AUDIO AU5: each rule, a waiver, and AMBER versus red. The m4a files are
// built here, box by box, in the one layout `aacIndex.ts` admits.

type Bytes = readonly number[]

interface M4aShape {
  readonly channels: 1 | 2
  readonly packets: number
  readonly packetBytes: number
  readonly edts?: boolean
  readonly headerChannels?: number
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
  const asc = [0x11, 0x80 | (shape.channels << 3)]
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
    full('mdhd', u32(0), u32(0), u32(RATE), u32(frames), u32(0)),
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
  return { url, hash, bytes, role: 'sfx', codec: 'aac', ...shape }
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
  test('only /assets/music and /assets/sfx m4a and wav files count', (): void => {
    expect(isRecordingUrl('/assets/music/piano/title-3d1f713a.m4a')).toBe(true)
    expect(isRecordingUrl('/assets/sfx/best/hit.wav')).toBe(true)
    expect(isRecordingUrl('/assets/music/coral-drift/music.json')).toBe(false)
    expect(isRecordingUrl('/assets/baked/x.m4a')).toBe(false)
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
  test('green to 4 MB, AMBER over it; one hash counts once', (): void => {
    const none = { slug: 's', waiver: undefined, today: TODAY }
    expect(audioReport([row(4 * MB, 'a')], none).level).toBe('green')
    const rows = [row(3 * MB, 'a'), row(2 * MB, 'b'), row(2 * MB, 'b')]
    const amber = audioReport(rows, none)
    expect(amber).toMatchObject({ level: 'amber', files: 2, bytes: 5 * MB })
    expect((): void => {
      assertAudioAdmission(amber)
    }).not.toThrow()
  })
  test('red over 8 MB, and admission refuses it', (): void => {
    const none = { slug: 's', waiver: undefined, today: TODAY }
    const red = audioReport([row(5 * MB, 'a'), row(4 * MB, 'b')], none)
    expect(red.level).toBe('red')
    expect((): void => {
      assertAudioAdmission(red)
    }).toThrow(/Audio rules \(AU5\) refuse s: s holds 9\.00 MB/u)
  })
  test('pack prints AMBER with the numbers, even for a red', (): void => {
    const none = { slug: 'pine-hollow', waiver: undefined, today: TODAY }
    const report = audioReport([row(14_658_913, 'a')], none)
    expect(audioReportLines(report)).toEqual([
      'audio AMBER: pine-hollow 1 recordings, 14.66 MB (AMBER over 4.00 MB, red over 8.00 MB)',
      'AMBER audio budget: pine-hollow holds 14.66 MB of its own audio, over the 8.00 MB red line (red: api-server refuses this at upload)',
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
