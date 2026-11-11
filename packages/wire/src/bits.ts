import { BitReader } from './bit-reader.ts'
import { BitWriter } from './bit-writer.ts'

import type { BitSink, BitSource, Span } from './bit-io.ts'

// One door to the v1 bit IO: a writer for a body, a reader bounded to one.

/** A fresh writer for one record body at a time. */
function bitSink(): BitSink {
  return new BitWriter()
}

/** A reader bounded to one span. */
function bitSource(span: Span): BitSource {
  return new BitReader(span.bytes, span.start, span.end)
}

export { bitSink, bitSource }
