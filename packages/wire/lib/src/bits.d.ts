import type { BitSink, BitSource, Span } from './bit-io.ts';
/** A fresh writer for one record body at a time. */
declare function bitSink(): BitSink;
/** A reader bounded to one span. */
declare function bitSource(span: Span): BitSource;
export { bitSink, bitSource };
