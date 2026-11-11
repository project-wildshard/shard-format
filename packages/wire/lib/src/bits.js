import { BitReader } from './bit-reader.js';
import { BitWriter } from './bit-writer.js';
// One door to the v1 bit IO: a writer for a body, a reader bounded to one.
/** A fresh writer for one record body at a time. */
function bitSink() {
    return new BitWriter();
}
/** A reader bounded to one span. */
function bitSource(span) {
    return new BitReader(span.bytes, span.start, span.end);
}
export { bitSink, bitSource };
