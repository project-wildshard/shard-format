import { readUvarint, writeUvarint } from './framing.js';
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
function writeFixed(out, value, size) {
    let rest = value;
    for (let index = ZERO; index < size; index += ONE) {
        out.push(rest % BYTE_SPAN);
        rest = Math.floor(rest / BYTE_SPAN);
    }
}
function writeValue(out, field, value) {
    writeUvarint(out, field.id * TYPE_SPAN + WIRE_TYPES.indexOf(field.wire));
    const size = FIXED_SIZE[field.wire];
    if (typeof value !== 'number') {
        writeUvarint(out, value.length);
        out.push(...value);
    }
    else if (size === undefined) {
        writeUvarint(out, value);
    }
    else {
        writeFixed(out, value, size);
    }
}
const isList = (value) => Array.isArray(value);
function listOf(value) {
    if (value === undefined) {
        return [];
    }
    return isList(value) ? value : [value];
}
/** A cold record body: each present field, in declared order. */
function encodeCold(record, values) {
    const out = [];
    for (const field of record.fields) {
        for (const item of listOf(values[field.name])) {
            writeValue(out, field, item);
        }
    }
    return Uint8Array.from(out);
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
/** Read one key and its value at `at`; hold it if the record knows it. */
function readField(record, span, out) {
    const key = readUvarint(span.bytes, span.start, span.end);
    const type = WIRE_TYPES[key.value % TYPE_SPAN];
    if (type === undefined) {
        throw new WireDecodeError('A cold key has no wire type');
    }
    const read = readValue({ ...span, start: key.next }, type);
    const id = Math.floor(key.value / TYPE_SPAN);
    const field = record.fields.find((entry) => entry.id === id);
    if (field?.wire === type) {
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
