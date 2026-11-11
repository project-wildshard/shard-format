import type { Span } from '../../src/bit-io.ts';
/** One captured v0 packet as v1 work. */
interface V1Packet {
    readonly stream: string;
    readonly bytes: Uint8Array<ArrayBuffer>;
    /** The same values in the per-field-tag shape (5.6), bytes only. */
    readonly tagged: number;
    readonly encode: () => Uint8Array<ArrayBuffer>;
    readonly decode: () => unknown;
}
/** How to make one packet's v1 bytes and read them back. */
interface V1Work {
    readonly encode: () => Uint8Array<ArrayBuffer>;
    readonly decode: (bytes: Readonly<Uint8Array>) => unknown;
    /** The per-field-tag size; absent where the shapes are the same (cold). */
    readonly tagged?: number;
}
/** Encode once, decode once (a bad replay throws here, outside timing). */
declare function packetOf(stream: string, work: V1Work): V1Packet;
/** A one-record message's record body. */
declare function onlyRecord(bytes: Readonly<Uint8Array>): Span;
export { onlyRecord, packetOf, type V1Packet, type V1Work };
