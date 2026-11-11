import { bitSink } from '../../src/bits.js';
import { compileEncoder } from '../../src/encode.js';
import { asArm, asList, asStruct } from '../../src/values.js';
// WB2's second shape (5.6): the same values with a protobuf key on every
// present field, as the literal per-field-tag design would send them. Bytes
// only; nothing here is a codec. Scalars go as varints of the quantised word
// v1 writes, floats as 4 or 8 bytes, structs and arrays length-delimited,
// absent optionals as nothing. A frame row sends the columns that changed
// against the receiver's baseline row (all of them when the row is fresh);
// the owner block sends every column, keyed. An event's spawn columns are
// not counted, so events understate this shape a little.
const ZERO = 0;
const ONE = 1;
const CONTINUE = 128;
const BYTE_SPAN = 256;
const KEY_SHIFT = 8;
const F32_BYTES = 4;
const F64_BYTES = 8;
const WORD_BITS = 32;
const SHARED = bitSink();
const ENCODERS = new Map();
const utf8 = new TextEncoder();
/** The bytes a varint of `value` takes. */
function varintBytes(value) {
    let length = ONE;
    for (let rest = value; rest >= CONTINUE; rest = Math.floor(rest / CONTINUE)) {
        length += ONE;
    }
    return length;
}
/** A key: field id and wire type, as protobuf writes it. */
const keyBytes = (id) => varintBytes(id * KEY_SHIFT);
/** A length, then that many bytes. */
const delimited = (length) => varintBytes(length) + length;
/** A one-byte tag, then a delimited body. */
const taggedRecord = (body) => ONE + delimited(body);
/** A word on the wire: a float's fixed bytes, or a varint. */
const wordBytes = (column, word) => column.bits > WORD_BITS ? F64_BYTES : varintBytes(word);
const sum = (sizes) => sizes.reduce((total, size) => total + size, ZERO);
/** The quantised word v1 writes for a scalar node, read back from its bits. */
function wordOf(node, value) {
    const encode = ENCODERS.get(node) ?? compileEncoder(node);
    ENCODERS.set(node, encode);
    encode(SHARED, value);
    return SHARED.take().reduce((word, byte) => word * BYTE_SPAN + byte, ZERO);
}
/** A struct's fields, each present one with its key. */
function structBytes(fields, value) {
    const struct = asStruct(value);
    return sum(fields.map((field) => {
        // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
        const size = valueBytes(field.node, struct[field.name]);
        return size === undefined ? ZERO : keyBytes(field.id) + size;
    }));
}
/** A union's arm: its key, then its fields, delimited. */
function armBytes(arms, value) {
    const { arm, fields } = asArm(value);
    const found = arms.find((entry) => entry.name === arm);
    const body = found === undefined ? ZERO : structBytes(found.fields, fields);
    return delimited(keyBytes(found?.id ?? ONE) + delimited(body));
}
/** A nesting node's bytes after its key, or undefined when absent. */
function nestedBytes(node, value) {
    switch (node.kind) {
        case 'optional': {
            // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
            return value === undefined ? undefined : valueBytes(node.node, value);
        }
        case 'struct': {
            return delimited(structBytes(node.fields, value));
        }
        case 'array': {
            return delimited(sum(asList(value).map(
            // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
            (item) => valueBytes(node.node, item) ?? ZERO)));
        }
        case 'union': {
            return armBytes(node.arms, value);
        }
        case 'uint':
        case 'bool':
        case 'quant':
        case 'fixed':
        case 'angle':
        case 'enum':
        case 'ref':
        case 'f32':
        case 'f64':
        case 'text': {
            return undefined;
        }
        default: {
            throw new RangeError('Unknown wire node');
        }
    }
}
/** A value's bytes after its key, or undefined when absent. */
function valueBytes(node, value) {
    if (node.kind === 'f32' || node.kind === 'f64') {
        return node.kind === 'f32' ? F32_BYTES : F64_BYTES;
    }
    if (node.kind === 'text') {
        return delimited(utf8.encode(typeof value === 'string' ? value : '').length);
    }
    return ['optional', 'struct', 'array', 'union'].includes(node.kind)
        ? nestedBytes(node, value)
        : varintBytes(wordOf(node, value));
}
/** A record (`cmds`, `act`, an event) in the per-field-tag shape, framed. */
function taggedRecordBytes(fields, value) {
    return taggedRecord(structBytes(fields, value));
}
/** One row's changed columns, keyed, after its handle and length. */
function rowBytes(seen, handle, row) {
    const columns = seen.classOf(handle)?.row ?? [];
    const held = seen.raw?.fresh.has(handle) === true
        ? undefined
        : seen.base?.rows.get(handle);
    const body = sum(columns.map((column, at) => {
        const word = row[at] ?? ZERO;
        return held?.[at] === word
            ? ZERO
            : keyBytes(column.id) + wordBytes(column, word);
    }));
    return body === ZERO ? ZERO : varintBytes(handle) + delimited(body);
}
/** A decoded v1 frame, as the per-field-tag shape would send it. */
function taggedFrameBytes(seen, fallback) {
    const { raw } = seen;
    if (raw === undefined) {
        return fallback;
    }
    const header = [raw.tick, raw.baselineTick, raw.cell, raw.lastSeq].map((value, at) => keyBytes(at + ONE) + varintBytes(value));
    const owner = seen.owner.owner.map((column) => keyBytes(column.id) + (column.bits > WORD_BITS ? F64_BYTES : F32_BYTES));
    const ride = (raw.ride?.words.length ?? ZERO) * (ONE + F32_BYTES);
    const rows = [...raw.rows].map(([handle, row]) => rowBytes(seen, handle, row));
    return taggedRecord(sum(header) + sum(owner) + ride + sum(rows));
}
export { taggedFrameBytes, taggedRecord, taggedRecordBytes, varintBytes };
