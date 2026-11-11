import { countBits, indexBits } from './bounds.js';
import { generateStructEncoder } from './encode-gen.js';
import { fixedCodec } from './fixed.js';
import { asArm, asList, asNumber, asStruct } from './values.js';
const ZERO = 0;
const ONE = 1;
const TWO = 2;
const TAU = Math.PI * TWO;
const REF_BITS = 16;
const REF_TOP = 65_535;
const BYTE = 8;
const utf8 = new TextEncoder();
const clamp = (value, low, high) => Math.min(Math.max(value, low), high);
function uintEncoder(bits) {
    const top = TWO ** bits - ONE;
    return (writer, value) => {
        const rounded = Math.round(asNumber(value));
        writer.write(clamp(rounded, ZERO, top), bits);
    };
}
function quantEncoder(node) {
    const step = (node.max - node.min) / (TWO ** node.bits - ONE);
    return (writer, value) => {
        const held = clamp(asNumber(value), node.min, node.max);
        writer.write(Math.round((held - node.min) / step), node.bits);
    };
}
function fixedEncoder(node) {
    const codec = fixedCodec(node.bits, node.divisor, node.offset);
    const top = TWO ** node.bits - ONE;
    return (writer, value) => {
        const word = codec.encode(asNumber(value));
        writer.write(clamp(word, ZERO, top), node.bits);
    };
}
function angleEncoder(bits) {
    const turns = TWO ** bits;
    return (writer, value) => {
        const turn = ((asNumber(value) % TAU) + TAU) % TAU;
        writer.write(Math.round((turn / TAU) * turns) % turns, bits);
    };
}
function enumEncoder(values) {
    const index = new Map(values.map((word, at) => [
        word,
        at,
    ]));
    const bits = indexBits(values.length);
    return (writer, value) => {
        const at = typeof value === 'string' ? index.get(value) : undefined;
        if (at === undefined) {
            throw new RangeError(`Undeclared enum value ${JSON.stringify(value)}`);
        }
        writer.write(at, bits);
    };
}
function textEncoder(maxBytes) {
    return (writer, value) => {
        const bytes = utf8.encode(typeof value === 'string' ? value : '');
        if (bytes.length > maxBytes) {
            throw new RangeError('Net text exceeds its byte cap');
        }
        writer.write(bytes.length, BYTE);
        for (const byte of bytes) {
            writer.write(byte, BYTE);
        }
    };
}
function boolEncoder(writer, value) {
    writer.write(value === true ? ONE : ZERO, ONE);
}
function f32Encoder(writer, value) {
    writer.writeF32(asNumber(value));
}
function f64Encoder(writer, value) {
    writer.writeF64(asNumber(value));
}
function refEncoder(writer, value) {
    const handle = Math.round(asNumber(value));
    writer.write(clamp(handle, ZERO, REF_TOP), REF_BITS);
}
function optionalEncoder(inner) {
    return (writer, value) => {
        writer.write(value === undefined ? ZERO : ONE, ONE);
        if (value !== undefined) {
            inner(writer, value);
        }
    };
}
function arrayEncoder(inner, maxCount) {
    const bits = countBits(maxCount);
    return (writer, value) => {
        const list = asList(value);
        if (list.length > maxCount) {
            throw new RangeError(`An array holds at most ${String(maxCount)} values`);
        }
        writer.write(list.length, bits);
        for (const item of list) {
            inner(writer, item);
        }
    };
}
function structEncoder(fields) {
    // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
    return generateStructEncoder(fields, compileEncoder) ?? loopEncoder(fields);
}
/** The closure form, where a page refuses generated code (a CSP). */
function loopEncoder(fields) {
    // Parallel arrays and an index loop: this runs per field per message (WB2).
    const names = fields.map((field) => field.name);
    const encoders = fields.map(
    // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
    (field) => compileEncoder(field.node));
    const count = names.length;
    return (writer, value) => {
        const struct = asStruct(value);
        for (let index = ZERO; index < count; index += ONE) {
            encoders[index]?.(writer, struct[names[index] ?? '']);
        }
    };
}
function unionEncoder(node) {
    const byName = new Map();
    for (const arm of node.arms) {
        byName.set(arm.name, [arm.id, structEncoder(arm.fields)]);
    }
    return (writer, value) => {
        const { arm, fields } = asArm(value);
        const entry = byName.get(arm);
        if (entry === undefined) {
            throw new RangeError(`Undeclared arm ${arm}`);
        }
        const [id, encode] = entry;
        writer.write(id, node.bits);
        encode(writer, fields);
    };
}
const FLAT = {
    bool: boolEncoder,
    f32: f32Encoder,
    f64: f64Encoder,
    ref: refEncoder,
};
/** A node with no inner node: its encoder; undefined for a nesting node. */
function scalarEncoder(node) {
    switch (node.kind) {
        case 'uint': {
            return uintEncoder(node.bits);
        }
        case 'quant': {
            return quantEncoder(node);
        }
        case 'fixed': {
            return fixedEncoder(node);
        }
        case 'angle': {
            return angleEncoder(node.bits);
        }
        case 'enum': {
            return enumEncoder(node.values);
        }
        case 'text': {
            return textEncoder(node.maxBytes);
        }
        case 'bool':
        case 'f32':
        case 'f64':
        case 'ref': {
            return FLAT[node.kind];
        }
        case 'optional':
        case 'array':
        case 'struct':
        case 'union': {
            return undefined;
        }
        default: {
            throw new RangeError('Unknown wire node');
        }
    }
}
/** Compile one node's encoder. */
function compileEncoder(node) {
    // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
    return scalarEncoder(node) ?? nestedEncoder(node);
}
function nestedEncoder(node) {
    if (node.kind === 'optional') {
        return optionalEncoder(compileEncoder(node.node));
    }
    if (node.kind === 'array') {
        return arrayEncoder(compileEncoder(node.node), node.maxCount);
    }
    if (node.kind === 'struct') {
        return structEncoder(node.fields);
    }
    if (node.kind === 'union') {
        return unionEncoder(node);
    }
    throw new RangeError('Unknown wire node');
}
export { countBits, indexBits } from './bounds.js';
export { compileEncoder };
