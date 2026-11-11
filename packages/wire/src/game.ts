import { bitSink, bitSource } from './bits.ts'
import { asStruct, compileDecoder, compileEncoder } from './codec.ts'
import { readRecords, recordBytes } from './framing.ts'
import { WIRE_MESSAGES, WIRE_RECORDS } from './records.ts'
import { decodeTable } from './table-read.ts'
import { encodeTable } from './tables.ts'
import { WireDecodeError } from './wire-error.ts'

import type { Span } from './bit-io.ts'
import type { Decode, Encode, WireStruct } from './codec.ts'
import type { WireRecordSpan } from './framing.ts'
import type { WireField, WireMessage, WireNode, WireRecord } from './grammar.ts'

// WIRE-STABILITY 5.1-5.3: `cmds` and `act` as tagged records. Each side
// encodes in its own layout and decodes the peer's by the tables the
// handshake carried. An unknown record is skipped by its length and counted;
// a singleton that repeats refuses the message.

/** A record's body codec: encode locally, decode a peer's layout. */
interface BodyCodec {
  readonly encode: Encode
  readonly decode: Decode
}
/** One event: its local name and fields. */
interface WireEvent {
  readonly event: string
  readonly fields: WireStruct
}
/** What a message held: its known records, and the tags it skipped. */
interface ReadMessage {
  readonly records: readonly WireRecordSpan[]
  readonly skipped: readonly number[]
}

const ONE = 1
const SHARED = bitSink()
const NONE = 0
/** The `cmds`, `act` and `events` message tags. */
const TAG_CMDS = 2
const TAG_ACT = 3
const TAG_EVENTS = 6
const TICK_BITS = 32
const TICK_BYTES = 4
const KNOWN_TAGS = new Set(
  WIRE_MESSAGES.map((message: WireMessage): number => message.id),
)
const SINGLETONS = new Set(
  WIRE_MESSAGES.filter(
    (message: WireMessage): boolean => message.singleton,
  ).map((message: WireMessage): number => message.id),
)

const struct = (fields: readonly WireField[]): WireNode => ({
  kind: 'struct',
  fields,
})
/** One top-level table entry. */
const entry = (id: number, name: string, node: WireNode): WireField => ({
  id,
  name,
  node,
})

function localBody(tag: number): readonly WireField[] {
  const record = WIRE_RECORDS.find(
    (item: WireRecord): boolean => item.id === tag,
  )
  if (record === undefined) {
    throw new RangeError(`No record ${String(tag)}`)
  }
  return record.fields
}

/** A record's local body, as one struct node. */
function localBodyNode(tag: number): WireNode {
  return struct(localBody(tag))
}

/** The client's tables (hello): its command struct and its act union. */
function clientTables(): {
  readonly commandTable: Uint8Array
  readonly actTable: Uint8Array
} {
  // The whole record bodies travel, envelopes included, so a later minor
  // may add an envelope field or raise the bundle cap without a major.
  return {
    commandTable: encodeTable([entry(ONE, 'cmds', localBodyNode(TAG_CMDS))]),
    actTable: encodeTable([entry(ONE, 'act', localBodyNode(TAG_ACT))]),
  }
}

/** The one node a single-entry table holds, of the kind `local` is. */
function onlyNode(table: Readonly<Uint8Array>, local: WireNode): WireNode {
  const entries = decodeTable(table, NONE, table.length)
  const [first] = entries
  if (
    first === undefined ||
    entries.length !== ONE ||
    first.node.kind !== local.kind
  ) {
    throw new WireDecodeError('A single-entry table holds another shape')
  }
  return first.node
}

/** A record body codec: encode in the local layout, decode the peer's. */
function bodyCodec(tag: number, peer: WireNode): BodyCodec {
  const local = localBodyNode(tag)
  return {
    encode: compileEncoder(local),
    decode: compileDecoder(peer, local),
  }
}

/** The server's `cmds` codec for one client's command table. */
function commandsCodec(commandTable: Readonly<Uint8Array>): BodyCodec {
  return bodyCodec(TAG_CMDS, onlyNode(commandTable, localBodyNode(TAG_CMDS)))
}

/** The server's `act` codec for one client's act table. */
function actCodec(actTable: Readonly<Uint8Array>): BodyCodec {
  return bodyCodec(TAG_ACT, onlyNode(actTable, localBodyNode(TAG_ACT)))
}

/** The client's own `cmds` and `act` codecs: its layout both ways. */
function localCodecs(): {
  readonly commands: BodyCodec
  readonly act: BodyCodec
} {
  return {
    commands: bodyCodec(TAG_CMDS, localBodyNode(TAG_CMDS)),
    act: bodyCodec(TAG_ACT, localBodyNode(TAG_ACT)),
  }
}

/** Refuse a singleton record seen twice in one message. */
function once(seen: Set<number>, tag: number): void {
  if (SINGLETONS.has(tag) && seen.has(tag)) {
    throw new WireDecodeError(`A singleton record repeats: ${String(tag)}`)
  }
  seen.add(tag)
}

/** A message is one or more records (5.1). */
function nonEmpty(
  records: readonly WireRecordSpan[],
): readonly WireRecordSpan[] {
  if (records.length === NONE) {
    throw new WireDecodeError('A message holds no record')
  }
  return records
}

/** Split a message into records: unknown tags skipped, singletons once. */
function readMessage(bytes: Readonly<Uint8Array>): ReadMessage {
  const seen = new Set<number>()
  const records: WireRecordSpan[] = []
  const skipped: number[] = []
  for (const record of nonEmpty(readRecords(bytes, NONE, bytes.length))) {
    once(seen, record.tag)
    if (KNOWN_TAGS.has(record.tag)) {
      records.push(record)
    } else {
      skipped.push(record.tag)
    }
  }
  return { records, skipped }
}

/** One record body through a codec, under the body's end rule. */
function decodeBody(codec: BodyCodec, span: Span): WireStruct {
  const reader = bitSource(span)
  const value = asStruct(codec.decode(reader))
  reader.end()
  return value
}

/** A message holding one record, encoded by a codec. */
function encodeBody(
  codec: BodyCodec,
  tag: number,
  value: WireStruct,
): Uint8Array {
  try {
    codec.encode(SHARED, value)
  } catch (error) {
    SHARED.take()
    throw error
  }
  return recordBytes(tag, SHARED.take())
}

export {
  actCodec,
  entry,
  struct,
  clientTables,
  commandsCodec,
  decodeBody,
  encodeBody,
  localCodecs,
  readMessage,
  TAG_ACT,
  TAG_CMDS,
  TAG_EVENTS,
  TICK_BITS,
  TICK_BYTES,
  type BodyCodec,
  type WireEvent,
}
