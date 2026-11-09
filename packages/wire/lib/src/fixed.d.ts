/** A fixed field uses an integer divisor, never a reciprocal scale. */
interface FixedCodec {
    readonly bits: number;
    readonly divisor: number;
    readonly offset: number;
    readonly encode: (value: number) => number;
    readonly decode: (word: number) => number;
}
/** Quantize raw values; record admission and bit IO bound their domains. */
declare function fixedCodec(bits: number, divisor: number, offset: number): FixedCodec;
declare const STEER_AXIS_CODEC: FixedCodec;
export { fixedCodec, STEER_AXIS_CODEC, type FixedCodec };
