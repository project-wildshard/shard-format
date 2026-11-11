import { bitSink, bitSource } from './bits.js';
import { recordBytes } from './framing.js';
import { decodeSnapshot } from './snapshot-decode.js';
import { encodeSnapshot } from './snapshot-encode.js';
// WIRE-STABILITY 5.1 and 5.4: a frame is the `frame` record (tag 5) whose
// body is one client's snapshot, under the body's end rule.
const TAG_FRAME = 5;
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
/** The server's side: the intersection, and the required ones a client lacks. */
function selectCapabilities(client, server, required) {
    const offered = new Set(client);
    return {
        selected: server.filter((id) => offered.has(id)),
        missing: required.filter((id) => !offered.has(id)),
    };
}
export { decodeFrame, encodeFrame, selectCapabilities, TAG_FRAME, };
