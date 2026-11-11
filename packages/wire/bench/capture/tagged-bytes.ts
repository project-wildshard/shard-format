import { bitSink } from '../../src/bits.ts'
import { columnBits } from '../../src/columns.ts'
import { compileEncoder } from '../../src/encode.ts'
import { asArm, asList, asStruct } from '../../src/values.ts'

import type { Column } from '../../src/columns.ts'
import type { WireArm, WireField, WireNode } from '../../src/grammar.ts'
import type { WireValue } from '../../src/values.ts'
import type { FrameSeen } from './v1-frames.ts'

// WB2's second shape (5.6): the same values with a protobuf key on every
// present field, as the literal per-field-tag design would send them. Bytes
// only; nothing here is a codec. Scalars go as varints of the quantised word
// v1 writes, floats as 4 or 8 bytes, structs and arrays length-delimited,
// absent optionals as nothing. A frame row sends the columns that changed
// against the receiver's baseline row (all of them when the row is fresh);
// the owner block sends every column, keyed. An event's spawn columns are
// not counted, so events understate this shape a little.

const ZERO = 0
const ONE = 1
const TWO = 2
const BYTE = 8
const CONTINUE = 128
const BYTE_SPAN = 256
const KEY_SHIFT = 8
const F32_BYTES = 4
const F64_BYTES = 8
const WORD_BITS = 32
const SHARED = bitSink()
const ENCODERS = new Map<WireNode, ReturnType<typeof compileEncoder>>()
const utf8 = new TextEncoder()

/** The bytes a varint of `value` takes. */
function varintBytes(value: number): number {
  let length = ONE
  for (let rest = value; rest >= CONTINUE; rest = Math.floor(rest / CONTINUE)) {
    length += ONE
  }
  return length
}

/** A key: field id and wire type, as protobuf writes it. */
const keyBytes = (id: number): number => varintBytes(id * KEY_SHIFT)
/** A length, then that many bytes. */
const delimited = (length: number): number => varintBytes(length) + length
/** A one-byte tag, then a delimited body. */
const taggedRecord = (body: number): number => ONE + delimited(body)
/** A word on the wire: a float's fixed bytes, or a varint. */
const wordBytes = (column: Column, word: number): number =>
  column.bits > WORD_BITS ? F64_BYTES : varintBytes(word)
const sum = (sizes: readonly number[]): number =>
  sizes.reduce((total: number, size: number): number => total + size, ZERO)

/** The quantised word v1 writes for a scalar node, read back from its bits. */
function wordOf(node: WireNode, value: WireValue): number {
  const encode = ENCODERS.get(node) ?? compileEncoder(node)
  ENCODERS.set(node, encode)
  encode(SHARED, value)
  const bytes = SHARED.take()
  const padded = bytes.reduce(
    (word: number, byte: number): number => word * BYTE_SPAN + byte,
    ZERO,
  )
  return Math.floor(padded / TWO ** (bytes.length * BYTE - columnBits(node)))
}

/** A struct's fields, each present one with its key. */
function structBytes(fields: readonly WireField[], value: WireValue): number {
  const struct = asStruct(value)
  return sum(
    fields.map((field: WireField): number => {
      // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
      const size = valueBytes(field.node, struct[field.name])
      return size === undefined ? ZERO : keyBytes(field.id) + size
    }),
  )
}

/** A union's arm: its key, then its fields, delimited. */
function armBytes(arms: readonly WireArm[], value: WireValue): number {
  const { arm, fields } = asArm(value)
  const found = arms.find((entry: WireArm): boolean => entry.name === arm)
  const body = found === undefined ? ZERO : structBytes(found.fields, fields)
  return delimited(keyBytes(found?.id ?? ONE) + delimited(body))
}

/** A nesting node's bytes after its key, or undefined when absent. */
function nestedBytes(node: WireNode, value: WireValue): number | undefined {
  switch (node.kind) {
    case 'optional': {
      // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
      return value === undefined ? undefined : valueBytes(node.node, value)
    }
    case 'struct': {
      return delimited(structBytes(node.fields, value))
    }
    case 'array': {
      return delimited(
        sum(
          asList(value).map(
            // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
            (item: WireValue): number => valueBytes(node.node, item) ?? ZERO,
          ),
        ),
      )
    }
    case 'union': {
      return armBytes(node.arms, value)
    }
    case 'uint':
    case 'bool':
    case 'quant':
    case 'fixed':
    case 'angle':
    case 'enum':
    case 'ref':
    case 'f32':
    case 'f64':
    case 'text': {
      return undefined
    }
    default: {
      throw new RangeError('Unknown wire node')
    }
  }
}

/** A value's bytes after its key, or undefined when absent. */
function valueBytes(node: WireNode, value: WireValue): number | undefined {
  if (node.kind === 'f32' || node.kind === 'f64') {
    return node.kind === 'f32' ? F32_BYTES : F64_BYTES
  }
  if (node.kind === 'text') {
    return delimited(utf8.encode(typeof value === 'string' ? value : '').length)
  }
  return ['optional', 'struct', 'array', 'union'].includes(node.kind)
    ? nestedBytes(node, value)
    : varintBytes(wordOf(node, value))
}

/** A record (`cmds`, `act`, an event) in the per-field-tag shape, framed. */
function taggedRecordBytes(
  fields: readonly WireField[],
  value: WireValue,
): number {
  return taggedRecord(structBytes(fields, value))
}

/** One row's changed columns, keyed, after its handle and length. */
function rowBytes(
  seen: FrameSeen,
  handle: number,
  row: Readonly<Uint32Array>,
): number {
  const columns = seen.classOf(handle)?.row ?? []
  const held = seen.base?.rows.get(handle)
  const body = sum(
    columns.map((column: Column, at: number): number => {
      const word = row[at] ?? ZERO
      return held?.[at] === word
        ? ZERO
        : keyBytes(column.id) + wordBytes(column, word)
    }),
  )
  return body === ZERO ? ZERO : varintBytes(handle) + delimited(body)
}

/** A decoded v1 frame, as the per-field-tag shape would send it. */
function taggedFrameBytes(seen: FrameSeen, fallback: number): number {
  const { raw } = seen
  if (raw === undefined) {
    return fallback
  }
  const header = [raw.tick, raw.baselineTick, raw.cell, raw.lastSeq].map(
    (value: number, at: number): number =>
      keyBytes(at + ONE) + varintBytes(value),
  )
  const owner = seen.owner.owner.map(
    (column: Column): number =>
      keyBytes(column.id) + (column.bits > WORD_BITS ? F64_BYTES : F32_BYTES),
  )
  const ride = (raw.ride?.words.length ?? ZERO) * (ONE + F32_BYTES)
  const rows = [...raw.rows].map(
    ([handle, row]: readonly [number, Readonly<Uint32Array>]): number =>
      rowBytes(seen, handle, row),
  )
  // A gone row is its handle and a key; freshness is one bit per held row.
  const gone = [...(seen.base?.rows.keys() ?? [])]
    .filter((handle: number): boolean => !raw.rows.has(handle))
    .map((handle: number): number => varintBytes(handle) + ONE)
  const freshness = delimited(Math.ceil(raw.rows.size / BYTE))
  return taggedRecord(
    sum(header) + sum(owner) + ride + sum(rows) + sum(gone) + freshness,
  )
}

export { taggedFrameBytes, taggedRecord, taggedRecordBytes, varintBytes }
