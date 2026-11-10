import { BitWriter } from '../../frozen/v0/bits.js';
import { bytesText, textBytes } from './frame-data.js';
import { OriginalTextWriter } from './original-text-writer.js';
import { decodePacketValue, encodePacketInput, readPacketInput, } from './packet-input.js';
import { PreparedTextWriter } from './prepared-text-writer.js';
/** Byte oracle first. Prepared values stay outside timing, common codec dispatch does not. */
function preparePacket(record) {
    const bytes = textBytes(record.bytes);
    const input = readPacketInput(bytes);
    const writer = new OriginalTextWriter(bytes);
    const replay = encodePacketInput(input, () => writer);
    if (bytesText(new Uint8Array(replay)) !== record.bytes) {
        throw new Error('Frozen v0 packet replay differs from real bytes');
    }
    const { values } = writer;
    const restoresText = values.some((value) => value.original !== value.decoded);
    return {
        stream: input.kind,
        encode: () => encodePacketInput(input, () => restoresText ? new PreparedTextWriter(values) : new BitWriter()),
        encodeWith: (shared) => encodePacketInput(input, restoresText ? () => new PreparedTextWriter(values) : shared),
        decode: () => decodePacketValue(bytes),
    };
}
/** Refuse any non-identical replay before a transport packet reaches the sink. */
function capturePacket(bytes) {
    const record = { bytes: bytesText(bytes) };
    preparePacket(record);
    return record;
}
export { capturePacket, preparePacket, };
