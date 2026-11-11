import type { BitSink } from './bit-io.ts';
/** Writes one body; `take` detaches it, padded to a byte, and resets. */
declare class BitWriter implements BitSink {
    private bytes;
    private bit;
    write(value: number, bits: number): void;
    writeF32(value: number): void;
    writeF64(value: number): void;
    take(): Uint8Array<ArrayBuffer>;
    takeRecord(tag: number): Uint8Array<ArrayBuffer>;
    private grow;
}
export { BitWriter };
