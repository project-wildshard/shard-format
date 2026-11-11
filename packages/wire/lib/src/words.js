import { WireDecodeError } from './wire-error.js';
const ZERO = 0;
const ONE = 1;
const TWO = 2;
const TAU = Math.PI * TWO;
const F32_BYTES = 4;
const scratch = new DataView(new ArrayBuffer(F32_BYTES));
const numeric = (value) => typeof value === 'number' ? value : ZERO;
const clamp = (value, low, high) => Math.min(Math.max(value, low), high);
const IDENTITY = {
    toValue: (word) => word,
    toWord: numeric,
    fallback: ZERO,
};
const F32 = {
    toValue: (word) => {
        scratch.setUint32(ZERO, word);
        return scratch.getFloat32(ZERO);
    },
    toWord: (value) => {
        scratch.setFloat32(ZERO, numeric(value));
        return scratch.getUint32(ZERO);
    },
    fallback: ZERO,
};
function quantWords(min, max, bits) {
    const step = (max - min) / (TWO ** bits - ONE);
    return {
        toValue: (word) => min + word * step,
        toWord: (value) => Math.round((clamp(numeric(value), min, max) - min) / step),
        fallback: ZERO,
    };
}
function angleWords(bits) {
    const turns = TWO ** bits;
    const step = TAU / turns;
    return {
        toValue: (word) => word * step,
        toWord: (value) => Math.round((((numeric(value) % TAU) + TAU) % TAU) / step) % turns,
        fallback: ZERO,
    };
}
function enumWords(values, fallback) {
    const index = new Map(values.map((word, at) => [
        word,
        at,
    ]));
    const home = index.get(fallback) ?? ZERO;
    return {
        toValue: (word) => values[word] ?? fallback,
        toWord: (value) => typeof value === 'string' ? (index.get(value) ?? home) : home,
        fallback: home,
    };
}
/** How a column of this node reads and writes its words. */
function wordCodec(node) {
    switch (node.kind) {
        case 'quant': {
            return quantWords(node.min, node.max, node.bits);
        }
        case 'angle': {
            return angleWords(node.bits);
        }
        case 'enum': {
            return enumWords(node.values, node.default);
        }
        case 'f32': {
            return F32;
        }
        case 'uint':
        case 'bool':
        case 'ref':
        case 'f64':
        case 'fixed': {
            return IDENTITY;
        }
        case 'text':
        case 'optional':
        case 'array':
        case 'struct':
        case 'union': {
            throw new WireDecodeError(`A ${node.kind} field has no column word`);
        }
        default: {
            throw new WireDecodeError('Unknown wire node');
        }
    }
}
export { wordCodec };
