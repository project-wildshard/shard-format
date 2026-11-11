import {
  ascending,
  CELL_BITS,
  COUNT_BITS,
  HANDLE_BITS,
  NO_BASELINE,
  rowMask,
  SEQ_BITS,
  TICK_BITS,
  writeOwner,
  writeRide,
} from './snapshot.ts'

import type { BitSink } from './bit-io.ts'
import type { ClassColumns } from './columns.ts'
import type { RowSource, SnapshotInput } from './snapshot.ts'

// WIRE-STABILITY 5.4: the server encodes one client's frame body in its own
// layout, as v0's `encodeFrame` did; the record framing goes around it. Each
// row's mask is computed once; the hot loops index arrays directly (WB2).

const ZERO = 0
const ONE = 1
const TWO = 2

/** A row to send: its handle, columns, offset and changed-field mask. */
interface Sent {
  readonly handle: number
  readonly columns: ClassColumns
  readonly at: number
  readonly mask: number
}
/** The rows a frame sends, the rows it leaves, and the rows gone since its baseline. */
interface Plan {
  readonly changed: readonly Sent[]
  readonly left: readonly number[]
  readonly gone: readonly number[]
}

/** The frame a handle's row is a delta against, or undefined for a whole row. */
function baseOf(input: SnapshotInput, handle: number): RowSource | undefined {
  const { baseline } = input
  if (baseline?.visible.has(handle) !== true) {
    return undefined
  }
  return baseline.rowFrom === undefined
    ? baseline.frame
    : baseline.rowFrom(handle)
}

/** A visible handle's row to send, or undefined when it is left out. */
function sentOf(
  input: SnapshotInput,
  handle: number,
  columns: ClassColumns,
): Sent | undefined {
  const at = input.frame.offset(handle)
  if (at === undefined) {
    return undefined
  }
  const base = baseOf(input, handle)
  if (base !== undefined && input.due?.(handle) === false) {
    return undefined
  }
  const mask = rowMask(input.frame, at, {
    frame: base,
    at: base?.offset(handle),
    fields: columns.row.length,
  })
  return mask === ZERO ? undefined : { handle, columns, at, mask }
}

/** The handles the baseline held that this frame no longer shows. */
function goneOf(input: SnapshotInput): readonly number[] {
  const gone: number[] = []
  for (const handle of input.baseline?.visible ?? []) {
    if (!input.visible.has(handle)) {
      gone.push(handle)
    }
  }
  return gone
}

/** A visible handle's columns, if it has a row in this frame. */
function rowed(input: SnapshotInput, handle: number): ClassColumns | undefined {
  const columns = input.classOf(handle)
  return columns !== undefined &&
    columns.row.length > ZERO &&
    input.frame.offset(handle) !== undefined
    ? columns
    : undefined
}

/** Sort each visible handle into changed or left, and find the gone. */
function plan(input: SnapshotInput): Plan {
  const changed: Sent[] = []
  const left: number[] = []
  for (const handle of input.visible) {
    const columns = rowed(input, handle)
    const sent =
      columns === undefined ? undefined : sentOf(input, handle, columns)
    if (sent !== undefined) {
      changed.push(sent)
    } else if (columns !== undefined) {
      left.push(handle)
    }
  }
  // Sorted in place: `left` is this plan's own array.
  // oxlint-disable-next-line unicorn/no-array-sort -- a local array, sorted in place to spare a copy per frame
  return { changed, left: left.sort(ascending), gone: goneOf(input) }
}

function writeRow(writer: BitSink, input: SnapshotInput, sent: Sent): void {
  const { row } = sent.columns
  writer.write(sent.handle, HANDLE_BITS)
  writer.write(ZERO, ONE)
  writer.write(sent.mask, row.length)
  const { data } = input.frame
  let rest = sent.mask
  for (let index = ZERO; index < row.length && rest > ZERO; index += ONE) {
    if (rest % TWO === ONE) {
      writer.write(data[sent.at + index] ?? ZERO, row[index]?.bits ?? ZERO)
    }
    rest = Math.floor(rest / TWO)
  }
}

function writeHeader(writer: BitSink, input: SnapshotInput): void {
  writer.write(input.frame.tick, TICK_BITS)
  writer.write(input.baseline?.frame.tick ?? NO_BASELINE, TICK_BITS)
  writer.write(input.cell, CELL_BITS)
  writer.write(input.lastSeq, SEQ_BITS)
  writeOwner(writer, input.ownerClass.owner, input.owner)
  writeRide(writer, input.ride)
}

/** Write one client's frame body. */
function encodeSnapshot(writer: BitSink, input: SnapshotInput): void {
  writeHeader(writer, input)
  const { changed, left, gone } = plan(input)
  writer.write(changed.length + gone.length, COUNT_BITS)
  for (const handle of gone) {
    writer.write(handle, HANDLE_BITS)
    writer.write(ONE, ONE)
  }
  for (const sent of changed) {
    writeRow(writer, input, sent)
  }
  // P1-E5.3-F1: a row left out is due and unchanged (fresh) or not due (stale).
  for (const handle of left) {
    writer.write(input.due?.(handle) === false ? ZERO : ONE, ONE)
  }
}

export { encodeSnapshot }
