import {
  array,
  boolean,
  exactOptional,
  number,
  object,
  parse,
  string,
} from 'valibot'

interface CapturedRow {
  readonly handle: number
  readonly classId: number
  readonly words: string
}
interface Snapshot {
  readonly tick: number
  readonly rows: readonly CapturedRow[]
}
interface RowCall {
  readonly handle: number
  readonly source?: Snapshot | undefined
}
interface DueCall {
  readonly handle: number
  readonly value: boolean
}
interface CapturedBaseline {
  readonly frame: Snapshot
  readonly visible: readonly number[]
  readonly hasRowFrom: boolean
}
interface CapturedFrame {
  readonly frame: Snapshot
  readonly cell: number
  readonly lastSeq: number
  readonly ownerClass: number
  readonly owner: string
  readonly ride?: string | undefined
  readonly rideWords?: number | undefined
  readonly visible: readonly number[]
  readonly baseline?: CapturedBaseline | undefined
  readonly classes: readonly { readonly handle: number; readonly id: number }[]
  readonly hasDue: boolean
  readonly rowFromCalls: readonly RowCall[]
  readonly dueCalls: readonly DueCall[]
  readonly bytes: string
}

const RowSchema = object({
  handle: number(),
  classId: number(),
  words: string(),
})
const RowsSchema = array(RowSchema)
const SnapshotSchema = object({ tick: number(), rows: RowsSchema })
const VisibleSchema = array(number())
const BaselineSchema = object({
  frame: SnapshotSchema,
  visible: VisibleSchema,
  hasRowFrom: boolean(),
})
const ClassSchema = object({ handle: number(), id: number() })
const RowCallSchema = object({
  handle: number(),
  source: exactOptional(SnapshotSchema),
})
const DueSchema = object({ handle: number(), value: boolean() })
const CaptureSchema = object({
  frame: SnapshotSchema,
  cell: number(),
  lastSeq: number(),
  ownerClass: number(),
  owner: string(),
  ride: exactOptional(string()),
  rideWords: exactOptional(number()),
  visible: VisibleSchema,
  baseline: exactOptional(BaselineSchema),
  classes: array(ClassSchema),
  hasDue: boolean(),
  rowFromCalls: array(RowCallSchema),
  dueCalls: array(DueSchema),
  bytes: string(),
})

const WORD_BYTES = 4
const DOUBLE_BYTES = 8
const DOUBLE_WORDS = 2
const ZERO = 0
const ONE = 1

function bytesText(bytes: Readonly<Uint8Array>): string {
  const text = Array.from(bytes, (byte: number): string =>
    String.fromCodePoint(byte),
  ).join('')
  return btoa(text)
}

function textBytes(text: string): Uint8Array {
  const decoded = atob(text)
  const bytes = new Uint8Array(decoded.length)
  for (let index = ZERO; index < decoded.length; index += ONE) {
    bytes[index] = decoded.charCodeAt(index)
  }
  return bytes
}

function packWords(words: Readonly<ArrayLike<number>>): string {
  const bytes = new Uint8Array(words.length * WORD_BYTES)
  const view = new DataView(bytes.buffer)
  for (let index = ZERO; index < words.length; index += ONE) {
    view.setUint32(index * WORD_BYTES, words[index] ?? ZERO)
  }
  return bytesText(bytes)
}

function unpackWords(text: string): Uint32Array {
  const bytes = textBytes(text)
  if (bytes.length % WORD_BYTES !== ZERO) {
    throw new Error('Unaligned captured row')
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return Uint32Array.from(
    { length: bytes.length / WORD_BYTES },
    (_unused: unknown, index: number): number =>
      view.getUint32(index * WORD_BYTES),
  )
}

function packDoubles(values: Readonly<Float64Array>): string {
  const view = new DataView(new ArrayBuffer(values.length * DOUBLE_BYTES))
  const words = new Uint32Array(values.length * DOUBLE_WORDS)
  for (let index = ZERO; index < values.length; index += ONE) {
    view.setFloat64(index * DOUBLE_BYTES, values[index] ?? ZERO)
    words[index * DOUBLE_WORDS] = view.getUint32(index * DOUBLE_BYTES)
    words[index * DOUBLE_WORDS + ONE] = view.getUint32(
      index * DOUBLE_BYTES + WORD_BYTES,
    )
  }
  return packWords(words)
}

function unpackDoubles(text: string): Float64Array {
  const words = unpackWords(text)
  if (words.length % DOUBLE_WORDS !== ZERO) {
    throw new Error('Unaligned captured owner')
  }
  const view = new DataView(new ArrayBuffer(words.length * WORD_BYTES))
  for (let index = ZERO; index < words.length; index += ONE) {
    view.setUint32(index * WORD_BYTES, words[index] ?? ZERO)
  }
  return Float64Array.from(
    { length: words.length / DOUBLE_WORDS },
    (_unused: unknown, index: number): number =>
      view.getFloat64(index * DOUBLE_BYTES),
  )
}

function parseFrameCapture(value: unknown): CapturedFrame {
  return parse(CaptureSchema, value)
}

export {
  bytesText,
  textBytes,
  packWords,
  unpackWords,
  packDoubles,
  unpackDoubles,
  parseFrameCapture,
  type CapturedRow,
  type Snapshot,
  type RowCall,
  type DueCall,
  type CapturedFrame,
}
