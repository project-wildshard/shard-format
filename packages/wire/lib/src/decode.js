import { countBits, indexBits } from './bounds.js';
import { fixedCodec } from './fixed.js';
import { defaultValue, isStruct, structDefaults } from './values.js';
import { WireDecodeError } from './wire-error.js';
const ZERO = 0;
const ONE = 1;
const TWO = 2;
const TAU = Math.PI * TWO;
const REF_BITS = 16;
const BYTE = 8;
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
function readText(reader, maxBytes) {
    const length = reader.read(BYTE);
    if (length > maxBytes || length * BYTE > reader.remaining) {
        throw new WireDecodeError('Text overruns its bound');
    }
    const bytes = new Uint8Array(length);
    for (let index = ZERO; index < length; index += ONE) {
        bytes[index] = reader.read(BYTE);
    }
    try {
        return utf8.decode(bytes);
    }
    catch {
        throw new WireDecodeError('Text is not UTF-8');
    }
}
function enumDecoder(sender, receiver) {
    const bits = indexBits(sender.values.length);
    const local = receiver?.kind === 'enum' ? receiver : undefined;
    const known = new Set(local?.values ?? sender.values);
    return (reader) => {
        const word = sender.values[reader.read(bits)];
        if (word === undefined) {
            throw new WireDecodeError('An enum index is past its values');
        }
        // Words map by string; one the receiver doesn't know reads its default.
        return known.has(word) ? word : local?.default;
    };
}
function quantDecoder(node) {
    const step = (node.max - node.min) / (TWO ** node.bits - ONE);
    return (reader) => node.min + reader.read(node.bits) * step;
}
function fixedDecoder(node) {
    const codec = fixedCodec(node.bits, node.divisor, node.offset);
    return (reader) => codec.decode(reader.read(node.bits));
}
function angleDecoder(bits) {
    const turns = TWO ** bits;
    return (reader) => (reader.read(bits) / turns) * TAU;
}
const FLAT = {
    bool: (reader) => reader.read(ONE) === ONE,
    f32: (reader) => reader.readF32(),
    f64: (reader) => reader.readF64(),
    ref: (reader) => reader.read(REF_BITS),
};
/** A node with no inner node: its decoder; undefined for a nesting node. */
function scalarDecoder(node) {
    switch (node.kind) {
        case 'uint': {
            return (reader) => reader.read(node.bits);
        }
        case 'quant': {
            return quantDecoder(node);
        }
        case 'fixed': {
            return fixedDecoder(node);
        }
        case 'angle': {
            return angleDecoder(node.bits);
        }
        case 'text': {
            return (reader) => readText(reader, node.maxBytes);
        }
        case 'bool':
        case 'f32':
        case 'f64':
        case 'ref': {
            return FLAT[node.kind];
        }
        case 'enum':
        case 'optional':
        case 'array':
        case 'struct':
        case 'union': {
            return undefined;
        }
        default: {
            throw new WireDecodeError('Unknown wire node');
        }
    }
}
function optionalDecoder(inner) {
    return (reader) => reader.read(ONE) === ONE ? inner(reader) : undefined;
}
function arrayDecoder(inner, maxCount) {
    const bits = countBits(maxCount);
    return (reader) => {
        const count = reader.read(bits);
        if (count > maxCount || count > reader.remaining) {
            throw new WireDecodeError('An array count is past its bound');
        }
        const out = [];
        for (let index = ZERO; index < count; index += ONE) {
            out.push(inner(reader));
        }
        return out;
    };
}
/** Each sender field's decoder, and the receiver's name for it, if any. */
function fieldParts(sender, receiver) {
    const parts = [];
    for (const field of sender) {
        const slot = receiver?.find((entry) => entry.id === field.id);
        // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
        parts.push([slot?.name, compileDecoder(field.node, slot?.node)]);
    }
    return parts;
}
/** The receiver's fields the sender lacks, at their defaults. */
function missingDefaults(sender, receiver) {
    const sent = new Set(sender.map((field) => field.id));
    const defaults = structDefaults(receiver ?? []);
    return (receiver ?? [])
        .filter((field) => !sent.has(field.id))
        .map((field) => [
        field.name,
        defaults[field.name],
    ]);
}
function structDecoder(sender, receiver) {
    // Parallel arrays and an index loop: this runs per field per message (WB2).
    const parts = fieldParts(sender, receiver);
    const names = parts.map((part) => part[ZERO]);
    const decoders = parts.map((part) => part[ONE]);
    const missing = missingDefaults(sender, receiver);
    const count = parts.length;
    return (reader) => {
        const out = {};
        for (let index = ZERO; index < count; index += ONE) {
            const value = decoders[index]?.(reader);
            const name = names[index];
            if (name !== undefined) {
                out[name] = value;
            }
        }
        for (const [name, value] of missing) {
            out[name] = value;
        }
        return out;
    };
}
function unionDecoder(sender, receiver) {
    const mine = receiver?.kind === 'union' ? receiver.arms : [];
    const arms = new Map();
    for (const arm of sender.arms) {
        const local = mine.find((entry) => entry.id === arm.id);
        arms.set(arm.id, [local?.name, structDecoder(arm.fields, local?.fields)]);
    }
    return (reader) => {
        const arm = arms.get(reader.read(sender.bits));
        if (arm === undefined) {
            throw new WireDecodeError('An arm id is not in its sender table');
        }
        const fields = arm[ONE](reader);
        // An arm the receiver lacks is read and skipped: no value.
        return arm[ZERO] === undefined || !isStruct(fields)
            ? undefined
            : { arm: arm[ZERO], fields: fields };
    };
}
/** The inner node a receiver declares for a sender's optional or array. */
function innerOf(sender, receiver) {
    return receiver?.kind === sender.kind && 'node' in receiver
        ? receiver.node
        : undefined;
}
function wrappedDecoder(sender, receiver) {
    if (sender.kind !== 'optional' && sender.kind !== 'array') {
        return undefined;
    }
    // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
    const inner = compileDecoder(sender.node, innerOf(sender, receiver));
    return sender.kind === 'array'
        ? arrayDecoder(inner, sender.maxCount)
        : optionalDecoder(inner);
}
function nestedDecoder(sender, receiver) {
    const wrapped = wrappedDecoder(sender, receiver);
    if (wrapped !== undefined) {
        return wrapped;
    }
    if (sender.kind === 'struct') {
        return structDecoder(sender.fields, receiver?.kind === 'struct' ? receiver.fields : undefined);
    }
    if (sender.kind === 'union') {
        return unionDecoder(sender, receiver);
    }
    if (sender.kind === 'enum') {
        return enumDecoder(sender, receiver);
    }
    throw new WireDecodeError('Unknown wire node');
}
/** A sender's scalar read as a receiver of another kind: its default. */
function retyped(simple, receiver) {
    const fallback = defaultValue(receiver);
    return (reader) => {
        simple(reader);
        return fallback;
    };
}
/** Compile one decoder: the sender's layout, projected onto the receiver's. */
function compileDecoder(sender, receiver) {
    // A retype is a new id; a mismatched kind is read, skipped, and reads as
    // the receiver's default.
    const local = receiver?.kind === sender.kind ? receiver : undefined;
    const read = scalarDecoder(sender) ?? nestedDecoder(sender, local);
    return receiver === undefined || local !== undefined
        ? read
        : retyped(read, receiver);
}
export { compileDecoder };
