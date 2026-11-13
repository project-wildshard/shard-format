import {
  isoDate,
  maxLength,
  maxValue,
  minLength,
  minValue,
  number,
  pipe,
  safeInteger,
  strictObject,
  string,
} from 'valibot'

import type { GenericSchema } from 'valibot'

// AUDIO AU5: a dated waiver for a shard over the audio budget's red line. It
// lives in the shard's source (`src/shards/<folder>/audio-waiver.json`, one
// row per output slug); sharddev's build carries the row for its slug into
// the index as `admission.audioWaiver`, where admission reads it
// (`audio-rules.ts`).

/** A dated waiver for a shard over the red line. */
interface AudioWaiver {
  /** The slug it names; a waiver for another shard never applies. */
  readonly shard: string
  /** The last day it applies, `YYYY-MM-DD` (UTC). */
  readonly until: string
  /** The most bytes it lets through; growth past it is red again. */
  readonly maxBytes: number
  /** Why, and the row that closes it. */
  readonly reason: string
}

const NONE = 0
const ONE_CHAR = 1
const REASON_LIMIT = 240
const SLUG_LIMIT = 64
const MAX_WAIVER_BYTES = 450_000_000

const AudioWaiverSchema: GenericSchema<AudioWaiver, AudioWaiver> = strictObject(
  {
    shard: pipe(string(), minLength(ONE_CHAR), maxLength(SLUG_LIMIT)),
    until: pipe(string(), isoDate()),
    maxBytes: pipe(
      number(),
      safeInteger(),
      minValue(NONE),
      maxValue(MAX_WAIVER_BYTES),
    ),
    reason: pipe(string(), minLength(ONE_CHAR), maxLength(REASON_LIMIT)),
  },
)

export type { AudioWaiver }
export { AudioWaiverSchema }
