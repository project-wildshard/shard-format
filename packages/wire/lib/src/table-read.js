import { nodeProblems } from './node-checks.js';
import { TableReader } from './table-reader.js';
import { FIRST_CODE, KIND_CODES, unzigzag } from './tables.js';
import { WireDecodeError } from './wire-error.js';
const ZERO = 0;
const ONE = 1;
const label = (id) => `#${String(id)}`;
function readKind(reader) {
    const kind = KIND_CODES[reader.uvarint() - FIRST_CODE];
    if (kind === undefined) {
        throw new WireDecodeError('A table names a node kind this major lacks');
    }
    return kind;
}
function readFields(reader, depth) {
    const count = reader.count();
    const fields = [];
    for (let index = ZERO; index < count; index += ONE) {
        const id = reader.uvarint();
        // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
        fields.push({ id, name: label(id), node: readNode(reader, depth + ONE) });
    }
    return fields;
}
function readEnum(reader) {
    const count = reader.count();
    const values = [];
    for (let index = ZERO; index < count; index += ONE) {
        values.push(reader.word());
    }
    const fallback = values[reader.uvarint()];
    if (fallback === undefined) {
        throw new WireDecodeError('An enum default is past its values');
    }
    return { kind: 'enum', values, default: fallback };
}
function readUnion(reader, depth) {
    const bits = reader.uvarint();
    const fallback = reader.uvarint();
    const count = reader.count();
    const arms = [];
    for (let index = ZERO; index < count; index += ONE) {
        const id = reader.uvarint();
        arms.push({ id, name: label(id), fields: readFields(reader, depth) });
    }
    return { kind: 'union', bits, arms, default: label(fallback) };
}
function readScaled(reader, kind) {
    if (kind === 'quant') {
        const min = reader.f64();
        const max = reader.f64();
        return { kind, min, max, bits: reader.uvarint() };
    }
    if (kind === 'fixed') {
        const bits = reader.uvarint();
        const divisor = reader.uvarint();
        return { kind, bits, divisor, offset: unzigzag(reader.uvarint()) };
    }
    return undefined;
}
function readLeaf(reader, kind) {
    if (kind === 'uint' || kind === 'angle') {
        return { kind, bits: reader.uvarint() };
    }
    if (kind === 'text') {
        return { kind, maxBytes: reader.uvarint() };
    }
    if (kind === 'bool' || kind === 'f32' || kind === 'f64' || kind === 'ref') {
        return { kind };
    }
    return kind === 'enum' ? readEnum(reader) : readScaled(reader, kind);
}
function readNested(reader, kind, depth) {
    if (kind === 'optional') {
        // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
        return { kind, node: readNode(reader, depth + ONE) };
    }
    if (kind === 'array') {
        const maxCount = reader.uvarint();
        // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
        return { kind, maxCount, node: readNode(reader, depth + ONE) };
    }
    if (kind === 'union') {
        return readUnion(reader, depth);
    }
    return { kind: 'struct', fields: readFields(reader, depth) };
}
/** Read one node and everything inside it. */
function readNode(reader, depth) {
    reader.tick(depth);
    const kind = readKind(reader);
    return readLeaf(reader, kind) ?? readNested(reader, kind, depth);
}
/** Decode a table block: its top-level entries, each checked whole. */
function decodeTable(bytes, start, end) {
    const reader = new TableReader(bytes, start, end);
    const entries = readFields(reader, ZERO);
    if (!reader.done) {
        throw new WireDecodeError('A table has trailing bytes');
    }
    const problems = nodeProblems('table', { kind: 'struct', fields: entries });
    if (problems.length > ZERO) {
        throw new WireDecodeError(`A table is unsound: ${problems.join('; ')}`);
    }
    return entries;
}
export { decodeTable };
