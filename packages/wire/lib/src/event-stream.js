import { bitSink, bitSource } from './bits.js';
import { asStruct, compileDecoder, compileEncoder } from './codec.js';
import { WIRE_EVENTS } from './events.js';
import { readRecords, writeRecord } from './framing.js';
import { entry, struct, TAG_EVENTS, TICK_BITS, TICK_BYTES } from './game.js';
import { decodeTable } from './table-read.js';
import { encodeTable } from './tables.js';
import { WireDecodeError } from './wire-error.js';
const NONE = 0;
const NO_COLUMNS = {
    write: () => undefined,
    read: (_reader, fields) => fields,
};
const SHARED = bitSink();
const LOCAL = new Map();
for (const record of WIRE_EVENTS) {
    LOCAL.set(record.name, {
        record,
        encode: compileEncoder(struct(record.fields)),
    });
}
/** The server's event tables (welcome): every event record's fields. */
function eventTables() {
    return encodeTable(WIRE_EVENTS.map((record) => entry(record.id, record.name, struct(record.fields))));
}
function writeEvent(out, event, columns) {
    const local = LOCAL.get(event.event);
    if (local === undefined) {
        throw new RangeError(`Undeclared event ${event.event}`);
    }
    // One writer per process: `take` detaches each body and resets it.
    local.encode(SHARED, event.fields);
    if (local.record.tail === 'class-columns') {
        columns.write(SHARED, event.fields);
    }
    writeRecord(out, local.record.id, SHARED.take());
}
/** One `events` message: the tick, then each event as its own record. */
function encodeEvents(tick, events, columns = NO_COLUMNS) {
    SHARED.write(tick, TICK_BITS);
    const body = [...SHARED.take()];
    for (const event of events) {
        writeEvent(body, event, columns);
    }
    const out = [];
    writeRecord(out, TAG_EVENTS, Uint8Array.from(body));
    return Uint8Array.from(out);
}
/** The peer's events this receiver knows, by tag. */
function peerEvents(tables) {
    const peers = new Map();
    for (const sender of decodeTable(tables, NONE, tables.length)) {
        const record = WIRE_EVENTS.find((local) => local.id === sender.id);
        if (record !== undefined && sender.node.kind !== 'struct') {
            throw new WireDecodeError('An event table entry is not a struct');
        }
        if (record !== undefined) {
            peers.set(sender.id, {
                record,
                decode: compileDecoder(sender.node, struct(record.fields)),
            });
        }
    }
    return peers;
}
function readEvent(peer, span, columns) {
    const reader = bitSource(span);
    const fields = asStruct(peer.decode(reader));
    const full = peer.record.tail === 'class-columns' ? columns.read(reader, fields) : fields;
    reader.end();
    return { event: peer.record.name, fields: full };
}
/** An events record's tick, its first 4 bytes. */
function readTick(span) {
    if (span.end - span.start < TICK_BYTES) {
        throw new WireDecodeError('An events record has no tick');
    }
    return bitSource({ ...span, end: span.start + TICK_BYTES }).read(TICK_BITS);
}
/** Decoders for a server's event tables, projected onto local events. */
function eventsDecoder(tables, columns = NO_COLUMNS) {
    const peers = peerEvents(tables);
    return (span) => {
        const tick = readTick(span);
        const events = [];
        const skipped = [];
        for (const record of readRecords(span.bytes, span.start + TICK_BYTES, span.end)) {
            const peer = peers.get(record.tag);
            if (peer === undefined) {
                skipped.push(record.tag);
            }
            else {
                events.push(readEvent(peer, { bytes: span.bytes, start: record.start, end: record.end }, columns));
            }
        }
        return { tick, events, skipped };
    };
}
export { encodeEvents, eventsDecoder, eventTables, };
