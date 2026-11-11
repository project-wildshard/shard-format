import { readMessage } from '../../src/game.ts'

import type { Span } from '../../src/bit-io.ts'

// WB2: one captured packet as v1 work, its bytes checked by one decode
// before any timer runs, and its per-field-tag size for the record (5.6).

/** One captured v0 packet as v1 work. */
interface V1Packet {
  readonly stream: string
  readonly bytes: Uint8Array<ArrayBuffer>
  /** The same values in the per-field-tag shape (5.6), bytes only. */
  readonly tagged: number
  readonly encode: () => Uint8Array<ArrayBuffer>
  readonly decode: () => unknown
}
/** How to make one packet's v1 bytes and read them back. */
interface V1Work {
  readonly encode: () => Uint8Array<ArrayBuffer>
  readonly decode: (bytes: Readonly<Uint8Array>) => unknown
  /** The per-field-tag size; absent where the shapes are the same (cold). */
  readonly tagged?: number
}

/** Encode once, decode once (a bad replay throws here, outside timing). */
function packetOf(stream: string, work: V1Work): V1Packet {
  const bytes = work.encode()
  work.decode(bytes)
  return {
    stream,
    bytes,
    tagged: work.tagged ?? bytes.length,
    encode: work.encode,
    decode: (): unknown => work.decode(bytes),
  }
}

/** A one-record message's record body, through the receiver's message read. */
function onlyRecord(bytes: Readonly<Uint8Array>): Span {
  const [record] = readMessage(bytes).records
  if (record === undefined) {
    throw new Error('A v1 message holds no record')
  }
  return { bytes, start: record.start, end: record.end }
}

export { onlyRecord, packetOf, type V1Packet, type V1Work }
