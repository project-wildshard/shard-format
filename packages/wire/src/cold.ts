import { readUvarint, writeUvarint } from './framing.ts'
import { WireDecodeError } from './wire-error.ts'

import type { ByteSink, Span } from './bit-io.ts'
import type { ColdField, ColdRecord, ColdWireType } from './grammar.ts'

// WIRE-STABILITY 5.1: hello and welcome are cold records with protobuf-style
// keys, `id << 3 | wireType`, so they need no table. An unknown field is
// skipped by its wire type; a missing required field or a repeated singleton
// refuses the handshake.

/** A cold field's value: a number, or bytes for text, tables and ids. */
type ColdValue = number | Readonly<Uint8Array>
/** A cold record's fields by name; repeated fields hold every value. */
type ColdValues = Readonly<
  Partial<Record<string, ColdValue | readonly ColdValue[]>>
>

const WIRE_TYPES: readonly ColdWireType[] = [
  'uvarint',
  'fixed32',
  'fixed64',
  'bytes',
]
const TYPE_SPAN = 8
const ZERO = 0
const ONE = 1
const BYTE_SPAN = 256
const FIXED_SIZE: Readonly<Partial<Record<ColdWireType, number>>> = {
  fixed32: 4,
  fixed64: 8,
}

function writeFixed(out: ByteSink, value: number, size: number): void {
  let rest = value
  for (let index = ZERO; index < size; index += ONE) {
    out.push(rest % BYTE_SPAN)
    rest = Math.floor(rest / BYTE_SPAN)
  }
}

function writeValue(out: ByteSink, field: ColdField, value: ColdValue): void {
  writeUvarint(out, field.id * TYPE_SPAN + WIRE_TYPES.indexOf(field.wire))
  const size = FIXED_SIZE[field.wire]
  if (typeof value !== 'number') {
    writeUvarint(out, value.length)
    out.push(...value)
  } else if (size === undefined) {
    writeUvarint(out, value)
  } else {
    writeFixed(out, value, size)
  }
}

const isList = (
  value: ColdValue | readonly ColdValue[],
): value is readonly ColdValue[] => Array.isArray(value)

function listOf(value: ColdValues[string]): readonly ColdValue[] {
  if (value === undefined) {
    return []
  }
  return isList(value) ? value : [value]
}

/** A cold record body: each present field, in declared order. */
function encodeCold(record: ColdRecord, values: ColdValues): Uint8Array {
  const out: number[] = []
  for (const field of record.fields) {
    for (const item of listOf(values[field.name])) {
      writeValue(out, field, item)
    }
  }
  return Uint8Array.from(out)
}

function readFixed(span: Span, size: number): number {
  if (span.start + size > span.end) {
    throw new WireDecodeError('A cold field ends early')
  }
  let value = ZERO
  for (let index = size - ONE; index >= ZERO; index -= ONE) {
    value = value * BYTE_SPAN + (span.bytes[span.start + index] ?? ZERO)
  }
  return value
}

/** Read one value of a wire type at `span.start`. */
function readValue(
  span: Span,
  type: ColdWireType,
): { readonly value: ColdValue; readonly next: number } {
  const size = FIXED_SIZE[type]
  if (size !== undefined) {
    return { value: readFixed(span, size), next: span.start + size }
  }
  const head = readUvarint(span.bytes, span.start, span.end)
  if (type === 'uvarint') {
    return head
  }
  const stop = head.next + head.value
  if (stop > span.end) {
    throw new WireDecodeError('A cold field length runs past its record')
  }
  return { value: span.bytes.slice(head.next, stop), next: stop }
}

/** Hold one read value, refusing a singleton read twice. */
function hold(
  out: Map<string, ColdValue | readonly ColdValue[]>,
  field: ColdField,
  value: ColdValue,
): void {
  const held = out.get(field.name)
  if (field.repeated === true) {
    out.set(field.name, [...listOf(held), value])
  } else if (held === undefined) {
    out.set(field.name, value)
  } else {
    throw new WireDecodeError(`A cold field repeats: ${field.name}`)
  }
}

function checkRequired(
  record: ColdRecord,
  out: ReadonlyMap<string, unknown>,
): void {
  for (const field of record.fields) {
    if (field.required === true && !out.has(field.name)) {
      throw new WireDecodeError(
        `A required cold field is missing: ${field.name}`,
      )
    }
  }
}

/** Read one key and its value at `at`; hold it if the record knows it. */
function readField(
  record: ColdRecord,
  span: Span,
  out: Map<string, ColdValue | readonly ColdValue[]>,
): number {
  const key = readUvarint(span.bytes, span.start, span.end)
  const type = WIRE_TYPES[key.value % TYPE_SPAN]
  if (type === undefined) {
    throw new WireDecodeError('A cold key has no wire type')
  }
  const read = readValue({ ...span, start: key.next }, type)
  const id = Math.floor(key.value / TYPE_SPAN)
  const field = record.fields.find(
    (entry: ColdField): boolean => entry.id === id,
  )
  if (field?.wire === type) {
    hold(out, field, read.value)
  }
  return read.next
}

/** Decode a cold record body, refusing what 5.1 refuses. */
function decodeCold(record: ColdRecord, span: Span): ColdValues {
  const out = new Map<string, ColdValue | readonly ColdValue[]>()
  for (let at = span.start; at < span.end;) {
    at = readField(record, { ...span, start: at }, out)
  }
  checkRequired(record, out)
  return Object.fromEntries(out)
}

export { decodeCold, encodeCold, type ColdValue, type ColdValues }
