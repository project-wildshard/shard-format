import {
  array,
  boolean,
  literal,
  minLength,
  minValue,
  number,
  parse,
  picklist,
  pipe,
  strictObject,
  string,
  union,
  unknown,
  integer,
} from 'valibot'

import { unpackFrameWords } from './frame-words.ts'
import { preparePacket } from './packet-replay.ts'

import type { CapturedFrame } from './frame-data.ts'

const VERSION = 1
const ENGINE = 'cfd668102efcb7c10a6fb57d3021c1f3d23c37a5'
const ZERO = 0
const ONE = 1
const natural = pipe(number(), integer(), minValue(ZERO))
const positive = pipe(natural, minValue(ONE))
const packetFields = {
  tick: natural,
  direction: picklist(['up', 'down']),
  channel: picklist(['reliable', 'unreliable']),
  delivered: boolean(),
}
const PayloadSchema = strictObject({ bytes: string() })
const PacketSchema = union([
  strictObject({ ...packetFields, frame: natural }),
  strictObject({ ...packetFields, packet: PayloadSchema }),
])
const PackedSchema = strictObject({
  version: literal(VERSION),
  wordTable: array(string()),
  frames: array(unknown()),
})
const packetList = pipe(array(PacketSchema), minLength(ONE))
const SessionSchema = strictObject({
  version: literal(VERSION),
  engine: literal(ENGINE),
  product: pipe(string(), minLength(ONE)),
  ticks: positive,
  frames: PackedSchema,
  packets: packetList,
})
interface PacketFields {
  readonly tick: number
  readonly direction: 'up' | 'down'
  readonly channel: 'reliable' | 'unreliable'
  readonly delivered: boolean
}
type CapturedPacket = PacketFields &
  ({ readonly frame: number } | { readonly packet: { readonly bytes: string } })
interface StoredSession {
  readonly version: typeof VERSION
  readonly engine: typeof ENGINE
  readonly product: string
  readonly ticks: number
  readonly frames: {
    readonly version: typeof VERSION
    readonly wordTable: readonly string[]
    readonly frames: readonly unknown[]
  }
  readonly packets: readonly CapturedPacket[]
}
interface CapturedSession {
  readonly version: typeof VERSION
  readonly engine: typeof ENGINE
  readonly product: string
  readonly ticks: number
  readonly frames: readonly CapturedFrame[]
  readonly packets: readonly CapturedPacket[]
}
class PacketReplayGuard {
  private readonly references = new Set<number>()
  private readonly ticks: number
  private readonly frames: number
  public constructor(ticks: number, frames: number) {
    this.ticks = ticks
    this.frames = frames
  }
  public observe(packet: CapturedPacket): void {
    if (packet.tick >= this.ticks) {
      throw new Error('Packet lies outside the recording interval')
    }
    if ('frame' in packet) {
      this.frame(packet)
    } else {
      preparePacket(packet.packet)
    }
  }
  private frame(packet: PacketFields & { readonly frame: number }): void {
    if (
      packet.direction !== 'down' ||
      packet.frame >= this.frames ||
      this.references.has(packet.frame)
    ) {
      throw new Error('Invalid or repeated captured frame reference')
    }
    this.references.add(packet.frame)
  }
  public complete(): void {
    if (this.references.size !== this.frames) {
      throw new Error('A captured frame has no actual transport packet')
    }
  }
}
/** Validate every actual stream and per-handle callback before timing or storage. */
function parseStoredSession(value: unknown): StoredSession {
  const source = parse(SessionSchema, value)
  const frames = unpackFrameWords(source.frames)
  const guard = new PacketReplayGuard(source.ticks, frames.length)
  for (const packet of source.packets) {
    guard.observe(packet)
  }
  guard.complete()
  return source
}
/** Expanded values remain opaque, bit-exact snapshots from frozen-v0 replay. */
function parseSession(value: unknown): CapturedSession {
  const source = parseStoredSession(value)
  return { ...source, frames: unpackFrameWords(source.frames) }
}

export {
  VERSION,
  ENGINE,
  parseStoredSession,
  parseSession,
  type StoredSession,
  type CapturedSession,
}
