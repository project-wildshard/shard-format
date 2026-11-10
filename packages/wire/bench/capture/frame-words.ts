import { array, literal, object, parse, string, unknown } from 'valibot'

import { parseFrameCapture } from './frame-data.ts'
import { assertFrameReplay } from './frame-replay.ts'

import type { CapturedFrame } from './frame-data.ts'

const VERSION = 1
const ZERO = 0
const ONE = 1

interface PackedFrameWords {
  readonly version: typeof VERSION
  readonly wordTable: readonly string[]
  readonly frames: unknown
}
const DictionarySchema = object({
  version: literal(VERSION),
  wordTable: array(string()),
  frames: unknown(),
})
function wordField(key: string): boolean {
  return key === 'words' || key === 'owner' || key === 'ride'
}
/** Dictionary only the exact bit strings; no row, callback or packet is dropped. */
function packFrameWords(frames: readonly CapturedFrame[]): PackedFrameWords {
  if (frames.length === ZERO) {
    throw new Error('A recording requires actual captured frames')
  }
  for (const frame of frames) {
    assertFrameReplay(frame)
  }
  const index = new Map<string, number>()
  const wordTable: string[] = []
  const text = JSON.stringify(
    frames,
    (key: string, value: unknown): unknown => {
      if (!wordField(key) || value === undefined) {
        return value
      }
      if (typeof value !== 'string') {
        throw new TypeError('Captured words must be bit strings')
      }
      const found = index.get(value)
      if (found !== undefined) {
        return found
      }
      const at = wordTable.push(value) - ONE
      index.set(value, at)
      return at
    },
  )
  const packed: unknown = JSON.parse(text)
  return { version: VERSION, wordTable, frames: packed }
}
function unpackFrame(item: unknown, words: readonly string[]): CapturedFrame {
  const text = JSON.stringify(item, (key: string, field: unknown): unknown => {
    if (!wordField(key)) {
      return field
    }
    if (typeof field !== 'number' || !Number.isInteger(field) || field < ZERO) {
      throw new Error('Captured word reference must be an unsigned integer')
    }
    const word = words[field]
    if (word === undefined) {
      throw new Error('Missing captured word reference')
    }
    return word
  })
  const expanded: unknown = JSON.parse(text)
  const frame = parseFrameCapture(expanded)
  assertFrameReplay(frame)
  return frame
}

/** Validate and replay every expanded frame before returning it to any timing run. */
function unpackFrameWords(value: unknown): readonly CapturedFrame[] {
  const record = parse(DictionarySchema, value)
  const packed = parse(array(unknown()), record.frames)
  if (packed.length === ZERO) {
    throw new Error('A recording requires actual captured frames')
  }
  const frames: CapturedFrame[] = []
  for (const item of packed) {
    // One expanded text/parse temporary, with the same grammar and byte oracle.
    frames.push(unpackFrame(item, record.wordTable))
  }
  return frames
}

export { packFrameWords, unpackFrameWords, type PackedFrameWords }
