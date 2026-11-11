const BITS_8 = 8;
const BITS_10 = 10;
const BITS_16 = 16;
const BITS_32 = 32;
function v0Angle(bits) {
    if (bits === BITS_8 || bits === BITS_10 || bits === BITS_16) {
        return bits;
    }
    throw new RangeError(`A v0 angle has 8, 10 or 16 bits, not ${String(bits)}`);
}
function v0Uint(bits) {
    if (bits === BITS_8) {
        return 'u8';
    }
    if (bits === BITS_16) {
        return 'u16';
    }
    if (bits === BITS_32) {
        return 'u32';
    }
    throw new RangeError(`A v0 uint has 8, 16 or 32 bits, not ${String(bits)}`);
}
/** The v0 kind and bounds of a class field node. */
function v0Kind(node) {
    switch (node.kind) {
        case 'quant': {
            return { kind: 'f32q', min: node.min, max: node.max, bits: node.bits };
        }
        case 'angle': {
            return { kind: 'angle', bits: v0Angle(node.bits) };
        }
        case 'uint': {
            return { kind: v0Uint(node.bits) };
        }
        case 'enum': {
            return { kind: 'enum', values: node.values };
        }
        case 'f32':
        case 'f64':
        case 'bool':
        case 'ref': {
            return { kind: node.kind };
        }
        case 'text': {
            return { kind: 'text' };
        }
        case 'fixed':
        case 'optional':
        case 'array':
        case 'struct':
        case 'union': {
            throw new RangeError(`A v0 class field cannot be ${node.kind}`);
        }
        default: {
            throw new RangeError('Unknown wire node');
        }
    }
}
/** A class field's whole v0 form: kind, bounds, audience and prediction. */
function v0Field(field) {
    return {
        ...v0Kind(field.node),
        ...(field.send === undefined ? {} : { send: field.send }),
        ...(field.predicted === true ? { predicted: true } : {}),
    };
}
export { v0Field };
