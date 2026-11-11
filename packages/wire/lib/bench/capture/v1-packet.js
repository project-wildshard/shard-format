import { readRecords } from '../../src/framing.js';
const NONE = 0;
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
/** A one-record message's record body. */
function onlyRecord(bytes) {
    const [record] = readRecords(bytes, NONE, bytes.length);
    if (record === undefined) {
        throw new Error('A v1 message holds no record');
    }
    return { bytes, start: record.start, end: record.end };
}
export { onlyRecord, packetOf };
