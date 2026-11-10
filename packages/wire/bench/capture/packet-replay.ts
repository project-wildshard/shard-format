import { BitReader, BitWriter } from '../../frozen/v0/bits.ts'
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
  readonly encode: (writer: BitWriter) => ArrayBuffer
  readonly decode: () => unknown
}
interface TextValue {
  readonly decoded: string
  readonly original: string
}
const BYTE_BITS = 8
const MAX_READ_BITS = 32
const decoder = new TextDecoder('utf-8', { fatal: true })
const originalDecoder = new TextDecoder('utf-8', {
  fatal: true,
  ignoreBOM: true,
})

/** Observe text positions once in preparation, never during encode timing. */
class OriginalTextWriter extends BitWriter {
  public readonly values: TextValue[] = []
  private offset = 0
  private readonly source: Uint8Array
  public constructor(source: Uint8Array) {
    super()
    this.source = source
  }
  public override write(value: number, bits: number): void {
    super.write(value, bits)
    this.offset += bits
  }
  public override writeText(text: string): void {
    const reader = new BitReader(this.source)
    let remaining = this.offset
    while (remaining > 0) {
      const count = Math.min(remaining, MAX_READ_BITS)
      reader.read(count)
      remaining -= count
    }
    const bytes = Uint8Array.from(
      { length: reader.read(BYTE_BITS) },
      (): number => reader.read(BYTE_BITS),
    )
    if (decoder.decode(bytes) !== text) {
      throw new Error('Captured text differs from its frozen decoded value')
    }
    const original = originalDecoder.decode(bytes)
    this.values.push({ decoded: text, original })
    super.writeText(original)
  }
}
/** Used only for records containing a BOM; ordinary captures use BitWriter. */
class PreparedTextWriter extends BitWriter {
  private index = 0
  private readonly values: readonly TextValue[]
  public constructor(values: readonly TextValue[]) {
    super()
    this.values = values
  }
  public override writeText(text: string): void {
    const value = this.values[this.index]
    this.index += 1
    if (value === undefined || value.decoded !== text) {
      throw new Error('Captured text sequence differs')
    }
    super.writeText(value.original)
  }
  public override finish(): ArrayBuffer {
    if (this.index !== this.values.length) {
      throw new Error('Captured text sequence is incomplete')
    }
    return super.finish()
  }
}
const NO_HANDLE = 0
const HANDLE_TOP = 0xffff
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
function decodePacket(record: CapturedPacket): DecodedPacket {
  const bytes = textBytes(record.bytes)
  switch (bytes[0]) {
    case 1: {
      const value = required(decodeHello(bytes))
      return {
        stream: 'hello',
        encode: (writer): ArrayBuffer => encodeHello(writer, value),
        decode: (): unknown => required(decodeHello(bytes)),
      }
    }
    case 2: {
      const value = required(decodeCommands(bytes, ids))
      return {
        stream: 'commands',
        encode: (writer): ArrayBuffer => encodeCommands(writer, value, refs),
        decode: (): unknown => required(decodeCommands(bytes, ids)),
      }
    }
    case 3: {
      const value = required(decodeAct(bytes))
      return {
        stream: 'act',
        encode: (writer): ArrayBuffer => encodeAct(writer, value),
        decode: (): unknown => required(decodeAct(bytes)),
      }
    }
    case 4: {
      const value = required(decodeWelcome(bytes))
      return {
        stream: 'welcome',
        encode: (writer): ArrayBuffer => encodeWelcome(writer, value),
        decode: (): unknown => required(decodeWelcome(bytes)),
      }
    }
    case 6: {
      const value = required(decodeEvents(bytes, initial))
      return {
        stream: 'events',
        encode: (writer): ArrayBuffer =>
          encodeEvents(writer, value.tick, value.events, initial),
        decode: (): unknown => required(decodeEvents(bytes, initial)),
      }
    }
    default:
      throw new Error('Non-frame packet capture requires a frozen v0 stream')
  }
}

/** The byte oracle is mandatory when reading a persisted recording too. */
function preparePacket(record: CapturedPacket): PreparedPacket {
  const decoded = decodePacket(record)
  const writer = new OriginalTextWriter(textBytes(record.bytes))
  const replay = decoded.encode(writer)
  if (bytesText(new Uint8Array(replay)) !== record.bytes) {
    throw new Error('Frozen v0 packet replay differs from real bytes')
  }
  const values = writer.values
  const restoresText = values.some(
    (value): boolean => value.original !== value.decoded,
  )
  return {
    stream: decoded.stream,
    encode: (): ArrayBuffer =>
      decoded.encode(
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
