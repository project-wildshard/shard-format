import { MAX_ROW_FIELDS, rowFieldCount } from './lock.js';
// WIRE-STABILITY 5.2: ids are positive, unique within their space, and every
// node is bounded with a typed default. WR6 adds the release-diff rules.
const MIN_ID = 1;
const MIN_BITS = 1;
const MAX_BITS = 32;
const MIN_TEXT_BYTES = 1;
const MAX_TEXT_BYTES = 255;
const NONE = 0;
const ONE = 1;
const TWO = 2;
/** Ids that are not positive integers, or that repeat in one space. */
function checkSpace(space, entries) {
    const seen = new Map();
    const problems = [];
    for (const entry of entries) {
        if (!Number.isSafeInteger(entry.id) || entry.id < MIN_ID) {
            problems.push(`${space}.${entry.name}: id ${String(entry.id)} is not > 0`);
        }
        const other = seen.get(entry.id);
        if (other !== undefined) {
            problems.push(`${space}: id ${String(entry.id)} is both ${other} and ${entry.name}`);
        }
        seen.set(entry.id, entry.name);
    }
    return problems;
}
function checkBits(where, bits) {
    return Number.isInteger(bits) && bits >= MIN_BITS && bits <= MAX_BITS
        ? []
        : [`${where}: ${String(bits)} bits is outside 1 to 32`];
}
function checkEnum(where, node) {
    const distinct = node.values.length > NONE &&
        new Set(node.values).size === node.values.length;
    return [
        ...(distinct ? [] : [`${where}: enum values must be present and distinct`]),
        ...(node.values.includes(node.default)
            ? []
            : [`${where}: default ${node.default} is not a declared value`]),
    ];
}
function checkText(where, maxBytes) {
    return maxBytes >= MIN_TEXT_BYTES && maxBytes <= MAX_TEXT_BYTES
        ? []
        : [`${where}: text holds 1 to 255 bytes`];
}
function checkLeaf(where, node) {
    switch (node.kind) {
        case 'uint':
        case 'angle':
        case 'fixed':
        case 'union': {
            return checkBits(where, node.bits);
        }
        case 'quant': {
            return [
                ...checkBits(where, node.bits),
                ...(node.min < node.max ? [] : [`${where}: quant needs min < max`]),
            ];
        }
        case 'enum': {
            return checkEnum(where, node);
        }
        case 'text': {
            return checkText(where, node.maxBytes);
        }
        case 'array': {
            return Number.isSafeInteger(node.maxCount) && node.maxCount > NONE
                ? []
                : [`${where}: an array needs a positive maxCount`];
        }
        case 'f32':
        case 'f64':
        case 'bool':
        case 'ref':
        case 'optional':
        case 'struct': {
            return [];
        }
        default: {
            throw new RangeError('Unknown wire node');
        }
    }
}
/** The fields of a struct, record or arm: their ids, then each node. */
function checkFields(where, fields) {
    const problems = [...checkSpace(where, fields)];
    for (const field of fields) {
        // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
        problems.push(...checkNode(`${where}.${field.name}`, field.node));
    }
    return problems;
}
function checkUnion(where, node) {
    const named = node.arms.some((arm) => arm.name === node.default);
    const top = TWO ** node.bits - ONE;
    const wide = node.arms
        .filter((arm) => arm.id > top)
        .map((arm) => `${where}.${arm.name}: arm id ${String(arm.id)} needs more than ${String(node.bits)} bits`);
    return [
        ...checkSpace(where, node.arms),
        ...wide,
        ...node.arms.flatMap((arm) => checkFields(`${where}.${arm.name}`, arm.fields)),
        ...(named ? [] : [`${where}: default arm ${node.default} is not declared`]),
    ];
}
/** One node and everything inside it. */
function checkNode(where, node) {
    // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
    return [...checkLeaf(where, node), ...checkInner(where, node)];
}
/** What a node holds: an inner node, fields or arms. */
function checkInner(where, node) {
    switch (node.kind) {
        case 'optional':
        case 'array': {
            return checkNode(`${where}[]`, node.node);
        }
        case 'struct': {
            return checkFields(where, node.fields);
        }
        case 'union': {
            return checkUnion(where, node);
        }
        case 'uint':
        case 'bool':
        case 'f32':
        case 'f64':
        case 'quant':
        case 'fixed':
        case 'angle':
        case 'enum':
        case 'ref':
        case 'text': {
            return [];
        }
        default: {
            throw new RangeError('Unknown wire node');
        }
    }
}
function checkClassField(where, field) {
    return field.node.kind === 'text' && field.send !== 'initial'
        ? [`${where}.${field.name}: text is initial-only`]
        : [];
}
function checkClass(wireClass) {
    const where = `class.${wireClass.name}`;
    return [
        ...checkFields(where, wireClass.fields),
        ...(rowFieldCount(wireClass) > MAX_ROW_FIELDS
            ? [`${where}: more than 32 row fields`]
            : []),
        ...wireClass.fields.flatMap((field) => checkClassField(where, field)),
    ];
}
/**
 * Each message tag has exactly one body: a cold record (hello, welcome) or a
 * record, with the same id and name, and no two bodies share an id.
 */
function checkMessageBodies(set) {
    const bodies = [...set.cold, ...set.records];
    const unmatched = [
        ...set.messages.filter((message) => !bodies.some((body) => body.id === message.id && body.name === message.name)),
        ...bodies.filter((body) => !set.messages.some((message) => body.id === message.id && body.name === message.name)),
    ];
    return [
        ...checkSpace('message bodies', bodies),
        ...unmatched.map((entry) => `messages.${entry.name}: tag ${String(entry.id)} has no matching body`),
    ];
}
/** Everything wrong with a descriptor set; empty when it is sound. */
function validateDescriptors(set) {
    return [
        ...checkSpace('messages', set.messages),
        ...checkMessageBodies(set),
        ...checkSpace('events', set.events),
        ...checkSpace('classes', set.classes),
        ...set.cold.flatMap((record) => checkSpace(`cold.${record.name}`, record.fields)),
        ...[...set.records, ...set.events].flatMap((record) => checkFields(`record.${record.name}`, record.fields)),
        ...checkNode('acts', set.acts),
        ...checkNode('command', set.command),
        ...set.classes.flatMap((wireClass) => checkClass(wireClass)),
    ];
}
export { validateDescriptors };
