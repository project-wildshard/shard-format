import type { BitSink } from './bit-io.ts';
/** Writes one body; `take` detaches it, padded to a byte, and resets. */
declare class BitWriter implements BitSink {
    private bytes;
    private bit;
    write(value: number, bits: number): void;
    writeF32(value: number): void;
    writeF64(value: number): void;
    take(): Uint8Array<ArrayBuffer>;
    /** Write the next chunk of `word`'s low `left` bits; the bits taken. */
    private put;
    private grow;
}
export { BitWriter };
