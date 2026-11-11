import { bitSink, bitSource } from './bits.ts'
import { readRecords, recordBytes } from './framing.ts'
import { decodeSnapshot } from './snapshot-decode.ts'
import { encodeSnapshot } from './snapshot-encode.ts'
import { WireDecodeError } from './wire-error.ts'

import type { Span } from './bit-io.ts'
import type { RawFrame, SnapshotInput, SnapshotTable } from './snapshot.ts'

// WIRE-STABILITY 5.1 and 5.4: a frame is the `frame` record (tag 5) whose
// body is one client's snapshot, under the body's end rule.

const TAG_FRAME = 5
const ZERO = 0
const SHARED = bitSink()

/** One client's frame message. */
function encodeFrame(input: SnapshotInput): Uint8Array {
  encodeSnapshot(SHARED, input)
  return recordBytes(TAG_FRAME, SHARED.take())
}

/** A frame record's body, raw, or undefined when it cannot apply yet. */
function decodeFrame(span: Span, table: SnapshotTable): RawFrame | undefined {
  return decodeSnapshot(bitSource(span), table)
}

/** A frame message's one frame record, decoded raw, or undefined when it cannot apply yet. */
function decodeFrameMessage(
  bytes: Readonly<Uint8Array>,
  table: SnapshotTable,
): RawFrame | undefined {
  const [frame] = readRecords(bytes, ZERO, bytes.length)
  if (frame?.tag !== TAG_FRAME) {
    throw new WireDecodeError('A frame message holds no frame record')
  }
  return decodeFrame({ bytes, start: frame.start, end: frame.end }, table)
}

/** Which capabilities a welcome selects, and whether the client can play. */
interface Capabilities {
  readonly selected: readonly number[]
  readonly missing: readonly number[]
}

/** The server's side: the intersection, and the required ones a client lacks. */
function selectCapabilities(
  client: readonly number[],
  server: readonly number[],
  required: readonly number[],
): Capabilities {
  const offered = new Set(client)
  return {
    selected: server.filter((id: number): boolean => offered.has(id)),
    missing: required.filter((id: number): boolean => !offered.has(id)),
  }
}

export {
  decodeFrame,
  decodeFrameMessage,
  encodeFrame,
  selectCapabilities,
  TAG_FRAME,
  type Capabilities,
}
