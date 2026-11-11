import { readMessage } from '../../src/game.js';
/** Encode once, decode once (a bad replay throws here, outside timing). */
function packetOf(stream, work) {
    const bytes = work.encode();
    work.decode(bytes);
    return {
        stream,
        bytes,
        tagged: work.tagged ?? bytes.length,
        encode: work.encode,
        decode: () => work.decode(bytes),
    };
}
/** A one-record message's record body, through the receiver's message read. */
function onlyRecord(bytes) {
    const [record] = readMessage(bytes).records;
    if (record === undefined) {
        throw new Error('A v1 message holds no record');
    }
    return { bytes, start: record.start, end: record.end };
}
export { onlyRecord, packetOf };
