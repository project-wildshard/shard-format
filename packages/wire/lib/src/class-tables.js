import { writeUvarint } from './framing.js';
import { checkSpace } from './node-checks.js';
import { readNode } from './table-read.js';
import { TableReader } from './table-reader.js';
import { writeNode } from './tables.js';
import { classProblems } from './validate.js';
import { WireDecodeError } from './wire-error.js';
// WIRE-STABILITY 5.3: the server's entity class tables, in the welcome. Each
// class is its id, its relevance radius (0 for the whole cell) and its fields;
// each field is its id, its flags (audience, predicted, required) and its
// node. A peer's classes are checked as local ones are before any decoder
// is built from them.
const SENDS = ['all', 'owner', 'others', 'initial'];
const PREDICTED = 4;
const REQUIRED = 8;
const SEND_MASK = 4;
const ZERO = 0;
const ONE = 1;
const NO_RELEVANCE = 0;
const label = (id) => `#${String(id)}`;
function flagsOf(field) {
    return (SENDS.indexOf(field.send ?? 'all') +
        (field.predicted === true ? PREDICTED : ZERO) +
        (field.required === true ? REQUIRED : ZERO));
}
function writeClass(out, wireClass) {
    writeUvarint(out, wireClass.id);
    writeUvarint(out, wireClass.relevance ?? NO_RELEVANCE);
    writeUvarint(out, wireClass.fields.length);
    for (const field of wireClass.fields) {
        writeUvarint(out, field.id);
        writeUvarint(out, flagsOf(field));
        writeNode(out, field.node);
    }
}
/** The welcome's class table block. */
function encodeClassTables(classes) {
    const out = [];
    writeUvarint(out, classes.length);
    for (const wireClass of classes) {
        writeClass(out, wireClass);
    }
    return Uint8Array.from(out);
}
function readField(reader) {
    const id = reader.uvarint();
    const flags = reader.uvarint();
    const send = SENDS[flags % SEND_MASK];
    if (send === undefined || flags >= REQUIRED + REQUIRED) {
        throw new WireDecodeError('A class field has unknown flags');
    }
    return {
        id,
        name: label(id),
        node: readNode(reader, ONE),
        send,
        ...(Math.floor(flags / PREDICTED) % (ONE + ONE) === ONE
            ? { predicted: true }
            : {}),
        ...(flags >= REQUIRED ? { required: true } : {}),
    };
}
function readFields(reader) {
    const count = reader.count();
    const fields = [];
    for (let index = ZERO; index < count; index += ONE) {
        fields.push(readField(reader));
    }
    return fields;
}
function readClass(reader) {
    const id = reader.uvarint();
    const relevance = reader.uvarint();
    const fields = readFields(reader);
    const wireClass = {
        id,
        name: label(id),
        fields,
        ...(relevance === NO_RELEVANCE ? {} : { relevance }),
    };
    const problems = classProblems(wireClass);
    if (problems.length > ZERO) {
        throw new WireDecodeError(`A class table is unsound: ${problems.join('; ')}`);
    }
    return wireClass;
}
/** Refuse class id 0 or a class id twice: a lookup would pick one. */
function uniqueIds(classes) {
    const ids = checkSpace('classes', classes);
    if (ids.length > ZERO) {
        throw new WireDecodeError(`A class table is unsound: ${ids.join('; ')}`);
    }
    return classes;
}
/** Read a server's class table block. */
function decodeClassTables(bytes) {
    const reader = new TableReader(bytes, ZERO, bytes.length);
    const count = reader.count();
    const classes = [];
    for (let index = ZERO; index < count; index += ONE) {
        classes.push(readClass(reader));
    }
    if (!reader.done) {
        throw new WireDecodeError('A class table has trailing bytes');
    }
    return uniqueIds(classes);
}
export { decodeClassTables, encodeClassTables };
