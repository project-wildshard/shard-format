import { BitWriter } from '../../frozen/v0/bits.ts'
import { decodeCommands, encodeCommands } from '../../frozen/v0/command.ts'
import {
  decodeAct,
  decodeEvents,
  decodeHello,
  decodeWelcome,
  encodeAct,
  encodeEvents,
  encodeHello,
  encodeWelcome,
} from '../../frozen/v0/messages.ts'
import { V0_CLASSES } from '../../frozen/v0/tables.ts'
import { bytesText, textBytes } from './frame-data.ts'
import { OriginalTextWriter } from './original-text-writer.ts'
import { PreparedTextWriter } from './prepared-text-writer.ts'

import type { InitialBits } from '../../frozen/v0/messages.ts'

interface CapturedPacket {
  readonly bytes: string
}
interface PreparedPacket {
  readonly stream: string
  readonly encode: () => ArrayBuffer
  readonly decode: () => unknown
}
interface DecodedPacket {
  readonly stream: string
  readonly encode: (writer: () => BitWriter) => ArrayBuffer
  readonly decode: () => unknown
}
const ZERO = 0
const NO_HANDLE = 0
const HANDLE_TOP = 65_535
const PREFIX = 'captured-handle:'

function initial(cls: number): ReturnType<InitialBits> {
  const table = V0_CLASSES.find((row): boolean => row.id === cls)
  return table === undefined
    ? undefined
    : {
        bits: table.initial.map((column): number => column.bits),
        text: table.text.length,
      }
}
function ids(handle: number): string | undefined {
  return handle > NO_HANDLE && handle <= HANDLE_TOP
    ? `${PREFIX}${String(handle)}`
    : undefined
}
function refs(id: string): number {
  const handle = Number(id.slice(PREFIX.length))
  if (!id.startsWith(PREFIX) || ids(handle) !== id) {
    throw new Error('Invalid captured command handle')
  }
  return handle
}
function required<Value>(value: Value | null): Value {
  if (value === null) {
    throw new Error('Frozen v0 refuses captured packet')
  }
  return value
}

/** Decode once outside encode timing, retaining exact decoded input values.
 * Frames need their actual per-handle baselines and use FrameTrace instead.
 */
function hello(bytes: Readonly<Uint8Array>): DecodedPacket {
  const value = required(decodeHello(bytes))
  return {
    stream: 'hello',
    encode: (writer): ArrayBuffer => encodeHello(writer(), value),
    decode: (): unknown => required(decodeHello(bytes)),
  }
}

function commands(bytes: Readonly<Uint8Array>): DecodedPacket {
  const value = required(decodeCommands(bytes, ids))
  return {
    stream: 'commands',
    encode: (writer): ArrayBuffer => encodeCommands(writer(), value, refs),
    decode: (): unknown => required(decodeCommands(bytes, ids)),
  }
}

function act(bytes: Readonly<Uint8Array>): DecodedPacket {
  const value = required(decodeAct(bytes))
  return {
    stream: 'act',
    encode: (writer): ArrayBuffer => encodeAct(writer(), value),
    decode: (): unknown => required(decodeAct(bytes)),
  }
}

function welcome(bytes: Readonly<Uint8Array>): DecodedPacket {
  const value = required(decodeWelcome(bytes))
  return {
    stream: 'welcome',
    encode: (writer): ArrayBuffer => encodeWelcome(writer(), value),
    decode: (): unknown => required(decodeWelcome(bytes)),
  }
}

function events(bytes: Readonly<Uint8Array>): DecodedPacket {
  const value = required(decodeEvents(bytes, initial))
  return {
    stream: 'events',
    encode: (writer): ArrayBuffer =>
      encodeEvents(writer(), value.tick, value.events, initial),
    decode: (): unknown => required(decodeEvents(bytes, initial)),
  }
}

const CODECS: Readonly<
  Record<number, (bytes: Readonly<Uint8Array>) => DecodedPacket>
> = {
  1: hello,
  2: commands,
  3: act,
  4: welcome,
  6: events,
}
function decodePacket(record: CapturedPacket): DecodedPacket {
  const bytes = textBytes(record.bytes)
  const id = bytes.at(ZERO)
  const codec = id === undefined ? undefined : CODECS[id]
  if (codec === undefined) {
    throw new Error('Non-frame packet capture requires a frozen v0 stream')
  }
  return codec(bytes)
}

/** The byte oracle is mandatory when reading a persisted recording too. */
function preparePacket(record: CapturedPacket): PreparedPacket {
  const decoded = decodePacket(record)
  const writer = new OriginalTextWriter(textBytes(record.bytes))
  const replay = decoded.encode((): BitWriter => writer)
  if (bytesText(new Uint8Array(replay)) !== record.bytes) {
    throw new Error('Frozen v0 packet replay differs from real bytes')
  }
  const { values } = writer
  const restoresText = values.some(
    (value): boolean => value.original !== value.decoded,
  )
  return {
    stream: decoded.stream,
    encode: (): ArrayBuffer =>
      decoded.encode((): BitWriter =>
        restoresText ? new PreparedTextWriter(values) : new BitWriter(),
      ),
    decode: decoded.decode,
  }
}

/** Refuse any non-identical replay before a transport packet reaches the sink. */
function capturePacket(bytes: Readonly<Uint8Array>): CapturedPacket {
  const record: CapturedPacket = { bytes: bytesText(bytes) }
  preparePacket(record)
  return record
}

export {
  capturePacket,
  preparePacket,
  type CapturedPacket,
  type PreparedPacket,
}
