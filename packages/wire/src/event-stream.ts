import { bitSink, bitSource } from './bits.ts'
import { asStruct, compileDecoder, compileEncoder } from './codec.ts'
import { WIRE_EVENTS } from './events.ts'
import { nestedRecord, readRecords } from './framing.ts'
import { entry, struct, TAG_EVENTS, TICK_BITS, TICK_BYTES } from './game.ts'
import { decodeTable } from './table-read.ts'
import { encodeTable } from './tables.ts'
import { WireDecodeError } from './wire-error.ts'

import type { BitSink, BitSource, Span } from './bit-io.ts'
import type { Decode, Encode, WireStruct } from './codec.ts'
import type { WireEvent } from './game.ts'
import type { WireField, WireRecord } from './grammar.ts'

// WIRE-STABILITY 5.1: `events` is a record whose body is the tick, then one
// nested record per event, each with its own tag and length. An event the
// receiver doesn't know is skipped by its length, and its neighbours apply.
// A spawn's body continues with its class's columns, which WR4 writes.

/** A spawn's class columns, after its own fields (WR4 fills these). */
interface SpawnColumns {
  readonly write: (writer: BitSink, fields: WireStruct) => void
  readonly read: (reader: BitSource, fields: WireStruct) => WireStruct
}
/** One `events` record, read. */
interface ReadEvents {
  readonly tick: number
  readonly events: readonly WireEvent[]
  readonly skipped: readonly number[]
}
/** A local event's descriptor and encoder. */
interface LocalEvent {
  readonly record: WireRecord
  readonly encode: Encode
}
/** A peer's event, decoded onto a local one. */
interface PeerEvent {
  readonly record: WireRecord
  readonly decode: Decode
}

const NONE = 0
const NO_COLUMNS: SpawnColumns = {
  write: (): void => undefined,
  read: (_reader: BitSource, fields: WireStruct): WireStruct => fields,
}
const SHARED = bitSink()
const LOCAL = new Map<string, LocalEvent>()
for (const record of WIRE_EVENTS) {
  LOCAL.set(record.name, {
    record,
    encode: compileEncoder(struct(record.fields)),
  })
}

/** The server's event tables (welcome): every event record's fields. */
function eventTables(): Uint8Array {
  return encodeTable(
    WIRE_EVENTS.map((record: WireRecord): WireField =>
      entry(record.id, record.name, struct(record.fields)),
    ),
  )
}

function eventBody(
  event: WireEvent,
  columns: SpawnColumns,
): readonly [number, Uint8Array] {
  const local = LOCAL.get(event.event)
  if (local === undefined) {
    throw new RangeError(`Undeclared event ${event.event}`)
  }
  // One writer per process: `take` detaches each body and resets it, and a
  // throw resets it too, so a bad event never leaks bits into the next.
  try {
    local.encode(SHARED, event.fields)
    if (local.record.tail === 'class-columns') {
      columns.write(SHARED, event.fields)
    }
  } catch (error) {
    SHARED.take()
    throw error
  }
  return [local.record.id, SHARED.take()]
}

/** One `events` message: the tick, then each event as its own record. */
function encodeEvents(
  tick: number,
  events: readonly WireEvent[],
  columns: SpawnColumns = NO_COLUMNS,
): Uint8Array<ArrayBuffer> {
  SHARED.write(tick, TICK_BITS)
  const head = SHARED.take()
  const parts = events.map((event: WireEvent): readonly [number, Uint8Array] =>
    eventBody(event, columns),
  )
  return nestedRecord(TAG_EVENTS, head, parts)
}

/** The peer's events this receiver knows, by tag. */
function peerEvents(
  tables: Readonly<Uint8Array>,
): ReadonlyMap<number, PeerEvent> {
  const peers = new Map<number, PeerEvent>()
  for (const sender of decodeTable(tables, NONE, tables.length)) {
    const record = WIRE_EVENTS.find(
      (local: WireRecord): boolean => local.id === sender.id,
    )
    if (record !== undefined && sender.node.kind !== 'struct') {
      throw new WireDecodeError('An event table entry is not a struct')
    }
    if (record !== undefined) {
      peers.set(sender.id, {
        record,
        decode: compileDecoder(sender.node, struct(record.fields)),
      })
    }
  }
  return peers
}

function readEvent(
  peer: PeerEvent,
  span: Span,
  columns: SpawnColumns,
): WireEvent {
  const reader = bitSource(span)
  const fields = asStruct(peer.decode(reader))
  const full =
    peer.record.tail === 'class-columns' ? columns.read(reader, fields) : fields
  reader.end()
  return { event: peer.record.name, fields: full }
}

/** An events record's tick, its first 4 bytes. */
function readTick(span: Span): number {
  if (span.end - span.start < TICK_BYTES) {
    throw new WireDecodeError('An events record has no tick')
  }
  return bitSource({ ...span, end: span.start + TICK_BYTES }).read(TICK_BITS)
}

/** Decoders for a server's event tables, projected onto local events. */
function eventsDecoder(
  tables: Readonly<Uint8Array>,
  columns: SpawnColumns = NO_COLUMNS,
): (span: Span) => ReadEvents {
  const peers = peerEvents(tables)
  return (span: Span): ReadEvents => {
    const tick = readTick(span)
    const events: WireEvent[] = []
    const skipped: number[] = []
    for (const record of readRecords(
      span.bytes,
      span.start + TICK_BYTES,
      span.end,
    )) {
      const peer = peers.get(record.tag)
      if (peer === undefined) {
        skipped.push(record.tag)
      } else {
        events.push(
          readEvent(
            peer,
            { bytes: span.bytes, start: record.start, end: record.end },
            columns,
          ),
        )
      }
    }
    return { tick, events, skipped }
  }
}

export {
  encodeEvents,
  eventsDecoder,
  eventTables,
  type ReadEvents,
  type SpawnColumns,
}
