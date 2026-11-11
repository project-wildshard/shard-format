import { writeRecord } from '../../src/framing.ts'
import { readMessage, TAG_EVENTS } from '../../src/game.ts'
import { WireDecodeError } from '../../src/wire-error.ts'

import type { Span } from '../../src/bit-io.ts'

const EVENTS_TAG = TAG_EVENTS

/** The one known record in a message, as a span. */
function onlyRecord(bytes: Readonly<Uint8Array>): Span {
  const [record] = readMessage(bytes).records
  // oxlint-disable-next-line typescript/no-unnecessary-condition -- a message may hold none
  if (record === undefined) {
    throw new Error('The message holds no known record')
  }
  return { bytes, start: record.start, end: record.end }
}

/** The run refuses its bytes as malformed, and nothing else throws. */
function refuses(run: () => unknown): void {
  try {
    run()
  } catch (error) {
    if (error instanceof WireDecodeError) {
      return
    }
    throw error
  }
  throw new Error('Expected a refusal')
}

/** A record's bytes as a list, to splice records by hand. */
function bytesOf(span: Span, start: number, end: number): number[] {
  return [...span.bytes.subarray(start, end)]
}

/** An events record (tag 6) around a hand-built body. */
function eventsRecord(body: readonly number[]): Uint8Array {
  const out: number[] = []
  writeRecord(out, EVENTS_TAG, Uint8Array.from(body))
  return Uint8Array.from(out)
}

export { bytesOf, eventsRecord, onlyRecord, refuses }
