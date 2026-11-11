import { bitSink, bitSource } from './bits.js';
import { asStruct, compileDecoder, compileEncoder } from './codec.js';
import { readRecords, recordBytes } from './framing.js';
import { WIRE_MESSAGES, WIRE_RECORDS } from './records.js';
import { decodeTable } from './table-read.js';
import { encodeTable } from './tables.js';
import { WireDecodeError } from './wire-error.js';
const ONE = 1;
const SHARED = bitSink();
const NONE = 0;
/** The `cmds`, `act` and `events` message tags. */
const TAG_CMDS = 2;
const TAG_ACT = 3;
const TAG_EVENTS = 6;
const TICK_BITS = 32;
const TICK_BYTES = 4;
const KNOWN_TAGS = new Set(WIRE_MESSAGES.map((message) => message.id));
const SINGLETONS = new Set(WIRE_MESSAGES.filter((message) => message.singleton).map((message) => message.id));
const struct = (fields) => ({
    kind: 'struct',
    fields,
});
/** One top-level table entry. */
const entry = (id, name, node) => ({
    id,
    name,
    node,
});
function localBody(tag) {
    const record = WIRE_RECORDS.find((item) => item.id === tag);
    if (record === undefined) {
        throw new RangeError(`No record ${String(tag)}`);
    }
    return record.fields;
}
/** A record's local body, as one struct node. */
function localBodyNode(tag) {
    return struct(localBody(tag));
}
/** The client's tables (hello): its command struct and its act union. */
function clientTables() {
    // The whole record bodies travel, envelopes included, so a later minor
    // may add an envelope field or raise the bundle cap without a major.
    return {
        commandTable: encodeTable([entry(ONE, 'cmds', localBodyNode(TAG_CMDS))]),
        actTable: encodeTable([entry(ONE, 'act', localBodyNode(TAG_ACT))]),
    };
}
/** The one node a single-entry table holds, of the kind `local` is. */
function onlyNode(table, local) {
    const entries = decodeTable(table, NONE, table.length);
    const [first] = entries;
    if (first === undefined ||
        entries.length !== ONE ||
        first.node.kind !== local.kind) {
        throw new WireDecodeError('A single-entry table holds another shape');
    }
    return first.node;
}
/** A record body codec: encode in the local layout, decode the peer's. */
function bodyCodec(tag, peer) {
    const local = localBodyNode(tag);
    return {
        encode: compileEncoder(local),
        decode: compileDecoder(peer, local),
    };
}
/** The server's `cmds` codec for one client's command table. */
function commandsCodec(commandTable) {
    return bodyCodec(TAG_CMDS, onlyNode(commandTable, localBodyNode(TAG_CMDS)));
}
/** The server's `act` codec for one client's act table. */
function actCodec(actTable) {
    return bodyCodec(TAG_ACT, onlyNode(actTable, localBodyNode(TAG_ACT)));
}
/** The client's own `cmds` and `act` codecs: its layout both ways. */
function localCodecs() {
    return {
        commands: bodyCodec(TAG_CMDS, localBodyNode(TAG_CMDS)),
        act: bodyCodec(TAG_ACT, localBodyNode(TAG_ACT)),
    };
}
/** Refuse a singleton record seen twice in one message. */
function once(seen, tag) {
    if (SINGLETONS.has(tag) && seen.has(tag)) {
        throw new WireDecodeError(`A singleton record repeats: ${String(tag)}`);
    }
    seen.add(tag);
}
/** A message is one or more records (5.1). */
function nonEmpty(records) {
    if (records.length === NONE) {
        throw new WireDecodeError('A message holds no record');
    }
    return records;
}
/** Split a message into records: unknown tags skipped, singletons once. */
function readMessage(bytes) {
    const seen = new Set();
    const records = [];
    const skipped = [];
    for (const record of nonEmpty(readRecords(bytes, NONE, bytes.length))) {
        once(seen, record.tag);
        if (KNOWN_TAGS.has(record.tag)) {
            records.push(record);
        }
        else {
            skipped.push(record.tag);
        }
    }
    return { records, skipped };
}
/** One record body through a codec, under the body's end rule. */
function decodeBody(codec, span) {
    const reader = bitSource(span);
    const value = asStruct(codec.decode(reader));
    reader.end();
    return value;
}
/** A message holding one record, encoded by a codec. */
function encodeBody(codec, tag, value) {
    try {
        codec.encode(SHARED, value);
    }
    catch (error) {
        SHARED.take();
        throw error;
    }
    return recordBytes(tag, SHARED.take());
}
export { actCodec, entry, struct, clientTables, commandsCodec, decodeBody, encodeBody, localCodecs, readMessage, TAG_ACT, TAG_CMDS, TAG_EVENTS, TICK_BITS, TICK_BYTES, };
