const MIN_BITS = 1;
const MAX_BITS = 32;
const AXIS_BITS = 8;
const AXIS_DIVISOR = 127;
const AXIS_OFFSET = -128;
/** Quantize raw values; record admission and bit IO bound their domains. */
function fixedCodec(bits, divisor, offset) {
    if (!Number.isInteger(bits) ||
        bits < MIN_BITS ||
        bits > MAX_BITS ||
        !Number.isSafeInteger(divisor) ||
        divisor < MIN_BITS ||
        !Number.isSafeInteger(offset)) {
        throw new RangeError('Fixed codec requires bounded bits and an integer divisor/offset');
    }
    return {
        bits,
        divisor,
        offset,
        encode: (value) => Math.round(value * divisor) - offset,
        decode: (word) => (word + offset) / divisor,
    };
}
const STEER_AXIS_CODEC = fixedCodec(AXIS_BITS, AXIS_DIVISOR, AXIS_OFFSET);
export { fixedCodec, STEER_AXIS_CODEC };
