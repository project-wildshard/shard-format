import { writeUvarint } from './framing.js';
// WIRE-STABILITY 5.3: the tables a side sends in the handshake, in one closed
// binary form per WIRE_MAJOR. Ids and enum words travel; names stay local
// (the receiver projects by id). A node kind this major does not know refuses
// the handshake: a new kind is a major. table-read.ts reads them back.
/** A node kind's code in a table: its index here, plus one. */
const KIND_CODES = [
    'uint',
    'bool',
    'f32',
    'f64',
    'quant',
    'fixed',
    'angle',
    'enum',
    'ref',
    'text',
    'optional',
    'array',
    'struct',
    'union',
];
const FIRST_CODE = 1;
const ZERO = 0;
const ONE = 1;
const TWO = 2;
const F64_BYTES = 8;
const utf8 = new TextEncoder();
const scratch = new DataView(new ArrayBuffer(F64_BYTES));
/** A zigzag signed integer, for a fixed node's offset. */
const zigzag = (value) => value < ZERO ? -value * TWO - ONE : value * TWO;
const unzigzag = (value) => value % TWO === ONE ? -(value + ONE) / TWO : value / TWO;
function writeF64(out, value) {
    scratch.setFloat64(ZERO, value);
    for (let index = ZERO; index < F64_BYTES; index += ONE) {
        out.push(scratch.getUint8(index));
    }
}
function writeWord(out, word) {
    const bytes = utf8.encode(word);
    writeUvarint(out, bytes.length);
    out.push(...bytes);
}
function writeFields(out, fields) {
    writeUvarint(out, fields.length);
    for (const field of fields) {
        writeUvarint(out, field.id);
        // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
        writeNode(out, field.node);
    }
}
function writeEnum(out, node) {
    writeUvarint(out, node.values.length);
    for (const word of node.values) {
        writeWord(out, word);
    }
    writeUvarint(out, node.values.indexOf(node.default));
}
function writeUnion(out, node) {
    const fallback = node.arms.find((arm) => arm.name === node.default);
    writeUvarint(out, node.bits);
    writeUvarint(out, fallback?.id ?? ZERO);
    writeUvarint(out, node.arms.length);
    for (const arm of node.arms) {
        writeUvarint(out, arm.id);
        writeFields(out, arm.fields);
    }
}
function writeNested(out, node) {
    if (node.kind === 'optional') {
        // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
        writeNode(out, node.node);
    }
    else if (node.kind === 'array') {
        writeUvarint(out, node.maxCount);
        // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
        writeNode(out, node.node);
    }
    else if (node.kind === 'struct') {
        writeFields(out, node.fields);
    }
    else if (node.kind === 'union') {
        writeUnion(out, node);
    }
}
function writeQuant(out, node) {
    writeF64(out, node.min);
    writeF64(out, node.max);
    writeUvarint(out, node.bits);
}
/** A node's bounds and nested nodes, after its kind code. */
function writeBody(out, node) {
    if (node.kind === 'uint' || node.kind === 'angle') {
        writeUvarint(out, node.bits);
    }
    else if (node.kind === 'quant') {
        writeQuant(out, node);
    }
    else if (node.kind === 'fixed') {
        writeUvarint(out, node.bits);
        writeUvarint(out, node.divisor);
        writeUvarint(out, zigzag(node.offset));
    }
    else if (node.kind === 'text') {
        writeUvarint(out, node.maxBytes);
    }
    else if (node.kind === 'enum') {
        writeEnum(out, node);
    }
    else {
        writeNested(out, node);
    }
}
/** Append one node's table form: its kind code, then its body. */
function writeNode(out, node) {
    writeUvarint(out, KIND_CODES.indexOf(node.kind) + FIRST_CODE);
    writeBody(out, node);
}
/** A table: its top-level entries, each an id and a node. */
function encodeTable(entries) {
    const out = [];
    writeFields(out, entries);
    return Uint8Array.from(out);
}
export { encodeTable, FIRST_CODE, KIND_CODES, unzigzag };
