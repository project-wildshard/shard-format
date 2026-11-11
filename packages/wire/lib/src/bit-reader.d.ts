import type { BitSource } from './bit-io.ts';
/** Reads one body, `bytes[start, end)`; it never reads past it. */
declare class BitReader implements BitSource {
    private bit;
    private readonly stop;
    private readonly bytes;
    constructor(bytes: Readonly<Uint8Array>, start: number, end: number);
    get remaining(): number;
    read(bits: number): number;
    readF32(): number;
    readF64(): number;
    end(): void;
}
export { BitReader };
