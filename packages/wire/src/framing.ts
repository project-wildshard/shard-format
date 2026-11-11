import { WireDecodeError } from './wire-error.ts'

import type { ByteSink } from './bit-io.ts'

// WIRE-STABILITY 5.1: a game message is one or more records, each
// `tag: uvarint, length: uvarint, body`. A uvarint is LEB128, at most 5 bytes
// and 2^32 - 1, and minimal; a length past the end refuses the message. A
// message is at most 64 KiB. A v1 client's first message starts `W`, major.

/** One record: its tag and where its body lies in the message. */
interface WireRecordSpan {
  readonly tag: number
  readonly start: number
  readonly end: number
}
/** A uvarint read: its value and the offset after it. */
interface Read {
  readonly value: number
  readonly next: number
}
/** What a server does with a client's first message (5.1, 5.5). */
type Bootstrap =
  | { readonly kind: 'v1'; readonly start: number }
  | { readonly kind: 'reload' | 'retry' | 'refuse' }

const ZERO = 0
const ONE = 1
/** A uvarint byte's continuation threshold: 2^7. */
const CONTINUE = 128
const MAX_VARINT_BYTES = 5
const UINT32_LIMIT = 4_294_967_296
/** The largest game message, in bytes. */
const MAX_MESSAGE_BYTES = 65_536
/** The first byte of a v1 client's first message: ASCII `W`. */
const BOOTSTRAP = 87
/** The v0.1.x hello's first byte (`MSG_HELLO`). */
const V0_HELLO = 1
const BOOTSTRAP_BYTES = 2

/** Refuse what no uvarint holds: a fraction, a negative, NaN, 2^32 and up. */
function checkUvarint(value: number): void {
  if (!Number.isInteger(value) || value < ZERO || value >= UINT32_LIMIT) {
    throw new RangeError(`A uvarint holds 0 to 2^32 - 1, not ${String(value)}`)
  }
}

/** Append a uvarint's bytes. */
function writeUvarint(out: ByteSink, value: number): void {
  checkUvarint(value)
  let rest = value
  while (rest >= CONTINUE) {
    out.push((rest % CONTINUE) + CONTINUE)
    rest = Math.floor(rest / CONTINUE)
  }
  out.push(rest)
}

/** The checks on a uvarint's last byte: minimal and in range. */
function finish(value: number, byte: number, index: number): void {
  if (byte === ZERO && index > ZERO) {
    throw new WireDecodeError('A uvarint is not minimal')
  }
  if (value >= UINT32_LIMIT) {
    throw new WireDecodeError('A uvarint exceeds 2^32 - 1')
  }
}

/** The byte at `at`, refusing a uvarint that runs past `end`. */
function byteAt(bytes: Readonly<Uint8Array>, at: number, end: number): number {
  const byte = at < end ? bytes[at] : undefined
  if (byte === undefined) {
    throw new WireDecodeError('A uvarint is truncated')
  }
  return byte
}

/** Read a uvarint at `at`, never past `end`. */
function readUvarint(
  bytes: Readonly<Uint8Array>,
  at: number,
  end: number,
): Read {
  let value = ZERO
  for (let index = ZERO; index < MAX_VARINT_BYTES; index += ONE) {
    const byte = byteAt(bytes, at + index, end)
    value += (byte % CONTINUE) * CONTINUE ** index
    if (byte < CONTINUE) {
      finish(value, byte, index)
      return { value, next: at + index + ONE }
    }
  }
  throw new WireDecodeError('A uvarint is longer than 5 bytes')
}

/** Append one record: tag, length, body. */
function writeRecord(
  out: ByteSink,
  tag: number,
  body: Readonly<Uint8Array>,
): void {
  writeUvarint(out, tag)
  writeUvarint(out, body.length)
  out.push(...body)
}

/** One record at `at`: its span, refusing a length past `end`. */
function readRecord(
  bytes: Readonly<Uint8Array>,
  at: number,
  end: number,
): WireRecordSpan {
  const tag = readUvarint(bytes, at, end)
  if (tag.value === ZERO) {
    throw new WireDecodeError('A record tag is 0')
  }
  const length = readUvarint(bytes, tag.next, end)
  const stop = length.next + length.value
  if (stop > end) {
    throw new WireDecodeError('A record length runs past the message')
  }
  return { tag: tag.value, start: length.next, end: stop }
}

/** The bytes a uvarint of `value` takes. */
function uvarintLength(value: number): number {
  checkUvarint(value)
  let length = ONE
  for (let rest = value; rest >= CONTINUE; rest = Math.floor(rest / CONTINUE)) {
    length += ONE
  }
  return length
}

/** Write a uvarint into `out` at `at`; the offset after it. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- it writes into `out`
function putUvarint(out: Uint8Array, at: number, value: number): number {
  checkUvarint(value)
  let next = at
  let rest = value
  while (rest >= CONTINUE) {
    out[next] = (rest % CONTINUE) + CONTINUE
    rest = Math.floor(rest / CONTINUE)
    next += ONE
  }
  out[next] = rest
  return next + ONE
}

/** A nested record: its tag, and its body. */
type NestedPart = readonly [number, Readonly<Uint8Array>]

/** The bytes `prefix` and the nested records take, framed. */
function nestedLength(
  prefix: Readonly<Uint8Array>,
  parts: readonly NestedPart[],
): number {
  let { length } = prefix
  for (const [inner, body] of parts) {
    length += uvarintLength(inner) + uvarintLength(body.length) + body.length
  }
  return length
}

/** One record, `tag` then `prefix` and nested records, in one allocation (a hot path). */
function nestedRecord(
  tag: number,
  prefix: Readonly<Uint8Array>,
  parts: readonly NestedPart[],
): Uint8Array<ArrayBuffer> {
  const length = nestedLength(prefix, parts)
  const out = new Uint8Array(
    uvarintLength(tag) + uvarintLength(length) + length,
  )
  const start = putUvarint(out, putUvarint(out, ZERO, tag), length)
  out.set(prefix, start)
  let at = start + prefix.length
  for (const [inner, body] of parts) {
    at = putUvarint(out, putUvarint(out, at, inner), body.length)
    out.set(body, at)
    at += body.length
  }
  return out
}

/** One record as its own message, built in one allocation (a hot path). */
function recordBytes(
  tag: number,
  body: Readonly<Uint8Array>,
): Uint8Array<ArrayBuffer> {
  return nestedRecord(tag, body, [])
}

/** Every record in `bytes[start, end)`, in order; a bad frame refuses all. */
function readRecords(
  bytes: Readonly<Uint8Array>,
  start: number,
  end: number,
): readonly WireRecordSpan[] {
  if (end - start > MAX_MESSAGE_BYTES) {
    throw new WireDecodeError('A message exceeds 64 KiB')
  }
  const records: WireRecordSpan[] = []
  for (let at = start; at < end;) {
    const record = readRecord(bytes, at, end)
    records.push(record)
    at = record.end
  }
  return records
}

/** Check the two bootstrap bytes before any record parsing. */
function readBootstrap(bytes: Readonly<Uint8Array>, major: number): Bootstrap {
  const [first, second] = bytes
  if (first === V0_HELLO) {
    return { kind: 'reload' }
  }
  if (first !== BOOTSTRAP || second === undefined) {
    return { kind: 'refuse' }
  }
  if (second === major) {
    return { kind: 'v1', start: BOOTSTRAP_BYTES }
  }
  return { kind: second < major ? 'reload' : 'retry' }
}

/** The bootstrap bytes a v1 client writes first. */
function bootstrapBytes(major: number): readonly number[] {
  return [BOOTSTRAP, major]
}

export {
  bootstrapBytes,
  MAX_MESSAGE_BYTES,
  readBootstrap,
  readRecords,
  nestedRecord,
  putUvarint,
  readUvarint,
  recordBytes,
  UINT32_LIMIT,
  uvarintLength,
  writeRecord,
  writeUvarint,
  type Bootstrap,
  type WireRecordSpan,
}
