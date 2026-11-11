import { putUvarint, readUvarint, uvarintLength } from './framing.js';
import { WireDecodeError } from './wire-error.js';
const WIRE_TYPES = [
    'uvarint',
    'fixed32',
    'fixed64',
    'bytes',
];
const TYPE_SPAN = 8;
const ZERO = 0;
const ONE = 1;
const BYTE_SPAN = 256;
const FIXED_SIZE = {
    fixed32: 4,
    fixed64: 8,
};
/** The bytes one part takes, key included. */
function partLength(part) {
    const { key, value, size } = part;
    if (typeof value !== 'number') {
        return uvarintLength(key) + uvarintLength(value.length) + value.length;
    }
    return uvarintLength(key) + (size ?? uvarintLength(value));
}
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- it writes into `out`
function putFixed(out, at, part) {
    let rest = Number(part.value);
    const end = at + (part.size ?? ZERO);
    for (let index = at; index < end; index += ONE) {
        out[index] = rest % BYTE_SPAN;
        rest = Math.floor(rest / BYTE_SPAN);
    }
    return end;
}
/** Write one part into `out` at `at`; the offset after it. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- it writes into `out`
function putPart(out, at, part) {
    const next = putUvarint(out, at, part.key);
    const { value, size } = part;
    if (typeof value !== 'number') {
        const start = putUvarint(out, next, value.length);
        out.set(value, start);
        return start + value.length;
    }
    return size === undefined
        ? putUvarint(out, next, value)
        : putFixed(out, next, part);
}
const isList = (value) => Array.isArray(value);
function listOf(value) {
    if (value === undefined) {
        return [];
    }
    return isList(value) ? value : [value];
}
/** A cold record body: each present field, in declared order, in one allocation. */
function encodeCold(record, values) {
    const parts = record.fields.flatMap((field) => listOf(values[field.name]).map((value) => ({
        key: field.id * TYPE_SPAN + WIRE_TYPES.indexOf(field.wire),
        value,
        size: FIXED_SIZE[field.wire],
    })));
    let length = ZERO;
    for (const part of parts) {
        length += partLength(part);
    }
    const out = new Uint8Array(length);
    let at = ZERO;
    for (const part of parts) {
        at = putPart(out, at, part);
    }
    return out;
}
function readFixed(span, size) {
    if (span.start + size > span.end) {
        throw new WireDecodeError('A cold field ends early');
    }
    let value = ZERO;
    for (let index = size - ONE; index >= ZERO; index -= ONE) {
        value = value * BYTE_SPAN + (span.bytes[span.start + index] ?? ZERO);
    }
    return value;
}
/** Read one value of a wire type at `span.start`. */
function readValue(span, type) {
    const size = FIXED_SIZE[type];
    if (size !== undefined) {
        return { value: readFixed(span, size), next: span.start + size };
    }
    const head = readUvarint(span.bytes, span.start, span.end);
    if (type === 'uvarint') {
        return head;
    }
    const stop = head.next + head.value;
    if (stop > span.end) {
        throw new WireDecodeError('A cold field length runs past its record');
    }
    return { value: span.bytes.slice(head.next, stop), next: stop };
}
/** Hold one read value, refusing a singleton read twice. */
function hold(out, field, value) {
    const held = out.get(field.name);
    if (field.repeated === true) {
        out.set(field.name, [...listOf(held), value]);
    }
    else if (held === undefined) {
        out.set(field.name, value);
    }
    else {
        throw new WireDecodeError(`A cold field repeats: ${field.name}`);
    }
}
function checkRequired(record, out) {
    for (const field of record.fields) {
        if (field.required === true && !out.has(field.name)) {
            throw new WireDecodeError(`A required cold field is missing: ${field.name}`);
        }
    }
}
/** The record's field with this id; 0, or a known id of another wire type, refuses. */
function knownField(record, id, type) {
    if (id === ZERO) {
        throw new WireDecodeError('A cold field id is 0');
    }
    const field = record.fields.find((entry) => entry.id === id);
    if (field !== undefined && field.wire !== type) {
        throw new WireDecodeError(`A cold field has another wire type: ${field.name}`);
    }
    return field;
}
/** Read one key and its value at `at`; hold it if the record knows it. */
function readField(record, span, out) {
    const key = readUvarint(span.bytes, span.start, span.end);
    const type = WIRE_TYPES[key.value % TYPE_SPAN];
    if (type === undefined) {
        throw new WireDecodeError('A cold key has no wire type');
    }
    const read = readValue({ ...span, start: key.next }, type);
    const field = knownField(record, Math.floor(key.value / TYPE_SPAN), type);
    if (field !== undefined) {
        hold(out, field, read.value);
    }
    return read.next;
}
/** Decode a cold record body, refusing what 5.1 refuses. */
function decodeCold(record, span) {
    const out = new Map();
    for (let at = span.start; at < span.end;) {
        at = readField(record, { ...span, start: at }, out);
    }
    checkRequired(record, out);
    return Object.fromEntries(out);
}
export { decodeCold, encodeCold };
