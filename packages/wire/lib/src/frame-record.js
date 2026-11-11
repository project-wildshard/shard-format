import { bitSink, bitSource } from './bits.js';
import { readRecords, recordBytes } from './framing.js';
import { decodeSnapshot } from './snapshot-decode.js';
import { encodeSnapshot } from './snapshot-encode.js';
import { WireDecodeError } from './wire-error.js';
// WIRE-STABILITY 5.1 and 5.4: a frame is the `frame` record (tag 5) whose
// body is one client's snapshot, under the body's end rule.
const TAG_FRAME = 5;
const ZERO = 0;
const SHARED = bitSink();
/** One client's frame message. */
function encodeFrame(input) {
    encodeSnapshot(SHARED, input);
    return recordBytes(TAG_FRAME, SHARED.take());
}
/** A frame record's body, raw, or undefined when it cannot apply yet. */
function decodeFrame(span, table) {
    return decodeSnapshot(bitSource(span), table);
}
/** A frame message's one frame record, decoded raw, or undefined when it cannot apply yet. */
function decodeFrameMessage(bytes, table) {
    const [frame] = readRecords(bytes, ZERO, bytes.length);
    if (frame?.tag !== TAG_FRAME) {
        throw new WireDecodeError('A frame message holds no frame record');
    }
    return decodeFrame({ bytes, start: frame.start, end: frame.end }, table);
}
/** The server's side: the intersection, and the required ones a client lacks. */
function selectCapabilities(client, server, required) {
    const offered = new Set(client);
    return {
        selected: server.filter((id) => offered.has(id)),
        missing: required.filter((id) => !offered.has(id)),
    };
}
export { decodeFrame, decodeFrameMessage, encodeFrame, selectCapabilities, TAG_FRAME, };
