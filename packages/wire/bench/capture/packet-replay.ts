import { BitWriter } from '../../frozen/v0/bits.ts'
import { bytesText, textBytes } from './frame-data.ts'
import { OriginalTextWriter } from './original-text-writer.ts'
import {
  decodePacketValue,
  encodePacketInput,
  readPacketInput,
} from './packet-input.ts'
import { PreparedTextWriter } from './prepared-text-writer.ts'

interface CapturedPacket {
  readonly bytes: string
}
interface PreparedPacket {
  readonly stream: string
  readonly encode: () => ArrayBuffer
  readonly encodeWith: (writer: () => BitWriter) => ArrayBuffer
  readonly decode: () => unknown
}
/** Byte oracle first. Prepared values stay outside timing, common codec dispatch does not. */
function preparePacket(record: CapturedPacket): PreparedPacket {
  const bytes = textBytes(record.bytes)
  const input = readPacketInput(bytes)
  const writer = new OriginalTextWriter(bytes)
  const replay = encodePacketInput(input, (): BitWriter => writer)
  if (bytesText(new Uint8Array(replay)) !== record.bytes) {
    throw new Error('Frozen v0 packet replay differs from real bytes')
  }
  const { values } = writer
  const restoresText = values.some(
    (value): boolean => value.original !== value.decoded,
  )
  return {
    stream: input.kind,
    encode: (): ArrayBuffer =>
      encodePacketInput(input, (): BitWriter =>
        restoresText ? new PreparedTextWriter(values) : new BitWriter(),
      ),
    encodeWith: (shared: () => BitWriter): ArrayBuffer =>
      encodePacketInput(
        input,
        restoresText ? (): BitWriter => new PreparedTextWriter(values) : shared,
      ),
    decode: (): unknown => decodePacketValue(bytes),
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
