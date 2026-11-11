/** Where an encoder writes one record body. */
interface BitSink {
    /** Write the low `bits` (1 to 32) of an unsigned integer. */
    readonly write: (value: number, bits: number) => void;
    /** Write a float32's IEEE bits. */
    readonly writeF32: (value: number) => void;
    /** Write a double's IEEE bits (J140). */
    readonly writeF64: (value: number) => void;
    /** Detach the body, padded to a whole byte with zero bits. */
    readonly take: () => Uint8Array<ArrayBuffer>;
    /** Detach the body as one framed record, `tag` and length first (WB2). */
    readonly takeRecord: (tag: number) => Uint8Array<ArrayBuffer>;
}
/** Where a decoder reads one record body; every overrun throws. */
interface BitSource {
    /** Bits left in the body. */
    readonly remaining: number;
    /** Read `bits` (1 to 32) as an unsigned integer. */
    readonly read: (bits: number) => number;
    /** Read a float32 bit for bit. */
    readonly readF32: () => number;
    /** Read a double bit for bit. */
    readonly readF64: () => number;
    /** The v0 end rule, per body: fewer than 8 bits left, all of them zero. */
    readonly end: () => void;
}
/** Where table and cold-record writers append bytes. */
interface ByteSink {
    readonly push: (...bytes: readonly number[]) => number;
}
/** Where a record, cold record or table lies in a message. */
interface Span {
    readonly bytes: Readonly<Uint8Array>;
    readonly start: number;
    readonly end: number;
}
export type { BitSink, BitSource, ByteSink, Span };
