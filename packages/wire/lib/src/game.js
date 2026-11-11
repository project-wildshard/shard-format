import { bitSink, bitSource } from './bits.js';
import { asStruct, compileDecoder, compileEncoder } from './codec.js';
import { readRecords, writeRecord } from './framing.js';
import { WIRE_ACTS, WIRE_COMMAND, WIRE_MESSAGES, WIRE_RECORDS, } from './records.js';
import { decodeTable } from './table-read.js';
import { encodeTable } from './tables.js';
import { WireDecodeError } from './wire-error.js';
const ONE = 1;
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
/** The client's tables (hello): its command struct and its act union. */
function clientTables() {
    return {
        commandTable: encodeTable([entry(ONE, 'command', WIRE_COMMAND)]),
        actTable: encodeTable([entry(ONE, 'act', WIRE_ACTS)]),
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
function localBody(tag) {
    const record = WIRE_RECORDS.find((item) => item.id === tag);
    if (record === undefined) {
        throw new RangeError(`No record ${String(tag)}`);
    }
    return record.fields;
}
/** `cmds` carries an array of commands: the peer's command in that array. */
function peerNode(local, peer) {
    return local.kind === 'array' ? { ...local, node: peer } : peer;
}
/** A record body codec whose `slot` field is the peer's node from a table. */
function bodyCodec(tag, slot, peer) {
    const local = localBody(tag);
    const sender = local.map((field) => field.name === slot
        ? { ...field, node: peerNode(field.node, peer) }
        : field);
    return {
        encode: compileEncoder(struct(local)),
        decode: compileDecoder(struct(sender), struct(local)),
    };
}
/** The server's `cmds` codec for one client's command table. */
function commandsCodec(commandTable) {
    return bodyCodec(TAG_CMDS, 'commands', onlyNode(commandTable, WIRE_COMMAND));
}
/** The server's `act` codec for one client's act table. */
function actCodec(actTable) {
    return bodyCodec(TAG_ACT, 'act', onlyNode(actTable, WIRE_ACTS));
}
/** The client's own `cmds` and `act` codecs: its layout both ways. */
function localCodecs() {
    return {
        commands: bodyCodec(TAG_CMDS, 'commands', WIRE_COMMAND),
        act: bodyCodec(TAG_ACT, 'act', WIRE_ACTS),
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
    const writer = bitSink();
    codec.encode(writer, value);
    const out = [];
    writeRecord(out, tag, writer.take());
    return Uint8Array.from(out);
}
export { actCodec, entry, struct, clientTables, commandsCodec, decodeBody, encodeBody, localCodecs, readMessage, TAG_ACT, TAG_CMDS, TAG_EVENTS, TICK_BITS, TICK_BYTES, };
