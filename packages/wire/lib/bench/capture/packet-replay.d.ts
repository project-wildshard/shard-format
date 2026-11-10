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
/** Byte oracle first. Prepared values stay outside timing, common codec dispatch does not. */
declare function preparePacket(record: CapturedPacket): PreparedPacket;
/** Refuse any non-identical replay before a transport packet reaches the sink. */
declare function capturePacket(bytes: Readonly<Uint8Array>): CapturedPacket;
export { capturePacket, preparePacket, type CapturedPacket, type PreparedPacket, };
