import { BitWriter } from '../../frozen/v0/bits.ts';
interface CapturedPacket {
    readonly bytes: string;
}
interface PreparedPacket {
    readonly stream: string;
    readonly encode: () => ArrayBuffer;
    readonly encodeWith: (writer: () => BitWriter) => ArrayBuffer;
    readonly decode: () => unknown;
}
/** The byte oracle is mandatory when reading a persisted recording too. */
declare function preparePacket(record: CapturedPacket): PreparedPacket;
/** Refuse any non-identical replay before a transport packet reaches the sink. */
declare function capturePacket(bytes: Readonly<Uint8Array>): CapturedPacket;
export { capturePacket, preparePacket, type CapturedPacket, type PreparedPacket, };
