import { bitSink, bitSource } from './bits.ts'
import { asStruct, compileDecoder, compileEncoder } from './codec.ts'
import { readRecords, writeRecord } from './framing.ts'
import {
  WIRE_ACTS,
  WIRE_COMMAND,
  WIRE_MESSAGES,
  WIRE_RECORDS,
} from './records.ts'
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

/** The client's tables (hello): its command struct and its act union. */
function clientTables(): {
  readonly commandTable: Uint8Array
  readonly actTable: Uint8Array
} {
  return {
    commandTable: encodeTable([entry(ONE, 'command', WIRE_COMMAND)]),
    actTable: encodeTable([entry(ONE, 'act', WIRE_ACTS)]),
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

function localBody(tag: number): readonly WireField[] {
  const record = WIRE_RECORDS.find(
    (item: WireRecord): boolean => item.id === tag,
  )
  if (record === undefined) {
    throw new RangeError(`No record ${String(tag)}`)
  }
  return record.fields
}

/** `cmds` carries an array of commands: the peer's command in that array. */
function peerNode(local: WireNode, peer: WireNode): WireNode {
  return local.kind === 'array' ? { ...local, node: peer } : peer
}

/** A record body codec whose `slot` field is the peer's node from a table. */
function bodyCodec(tag: number, slot: string, peer: WireNode): BodyCodec {
  const local = localBody(tag)
  const sender = local.map((field: WireField): WireField =>
    field.name === slot
      ? { ...field, node: peerNode(field.node, peer) }
      : field,
  )
  return {
    encode: compileEncoder(struct(local)),
    decode: compileDecoder(struct(sender), struct(local)),
  }
}

/** The server's `cmds` codec for one client's command table. */
function commandsCodec(commandTable: Readonly<Uint8Array>): BodyCodec {
  return bodyCodec(TAG_CMDS, 'commands', onlyNode(commandTable, WIRE_COMMAND))
}

/** The server's `act` codec for one client's act table. */
function actCodec(actTable: Readonly<Uint8Array>): BodyCodec {
  return bodyCodec(TAG_ACT, 'act', onlyNode(actTable, WIRE_ACTS))
}

/** The client's own `cmds` and `act` codecs: its layout both ways. */
function localCodecs(): {
  readonly commands: BodyCodec
  readonly act: BodyCodec
} {
  return {
    commands: bodyCodec(TAG_CMDS, 'commands', WIRE_COMMAND),
    act: bodyCodec(TAG_ACT, 'act', WIRE_ACTS),
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
  const writer = bitSink()
  codec.encode(writer, value)
  const out: number[] = []
  writeRecord(out, tag, writer.take())
  return Uint8Array.from(out)
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
