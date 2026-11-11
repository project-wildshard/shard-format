import {
  ascending,
  bitSet,
  CELL_BITS,
  COUNT_BITS,
  DOUBLE_BITS,
  fullMask,
  HANDLE_BITS,
  LAW_BITS,
  NO_BASELINE,
  SEQ_BITS,
  TICK_BITS,
} from './snapshot.ts'
import { WireDecodeError } from './wire-error.ts'

import type { BitSource } from './bit-io.ts'
import type { ClassColumns } from './columns.ts'
import type { RawFrame, RideBlock, SnapshotTable } from './snapshot.ts'

// WIRE-STABILITY 5.4: the receiver reads a frame body by the sender's columns
// and keeps every row raw, whatever its class, so later masks and freshness
// bits stay aligned. A frame whose baseline is no longer held, or that names
// a handle whose spawn hasn't arrived, cannot apply yet: it gives undefined.

/** A frame being read: its source, the sender's table, and its rows. */
interface Reading {
  readonly reader: BitSource
  readonly table: SnapshotTable
  readonly rows: Map<number, Readonly<Uint32Array>>
  readonly fresh: Set<number>
}

const ZERO = 0
const ONE = 1

function readOwner(reader: BitSource, columns: ClassColumns): Float64Array {
  const owner = new Float64Array(columns.owner.length)
  for (const [index, column] of columns.owner.entries()) {
    owner[index] =
      column.bits === DOUBLE_BITS ? reader.readF64() : reader.read(column.bits)
  }
  return owner
}

function readRide(
  reader: BitSource,
  table: SnapshotTable,
): RideBlock | undefined {
  if (reader.read(ONE) === ZERO) {
    return undefined
  }
  const law = table.rideLaw(reader.read(LAW_BITS))
  if (law === undefined) {
    throw new WireDecodeError('A ride names a law its sender table lacks')
  }
  const words = new Float64Array(law.words)
  for (let index = ZERO; index < law.words; index += ONE) {
    words[index] = reader.readF32()
  }
  return { law: law.id, words }
}

/** A changed row's new words over its previous ones, if any. */
function readWords(
  reading: Reading,
  columns: ClassColumns,
  handle: number,
): Uint32Array {
  const fields = columns.row.length
  const mask = reading.reader.read(fields)
  const previous = reading.rows.get(handle)
  if (previous === undefined && mask !== fullMask(fields)) {
    throw new WireDecodeError('A delta row has no baseline')
  }
  const row = Uint32Array.from(previous ?? new Uint32Array(fields))
  for (const [index, column] of columns.row.entries()) {
    if (bitSet(mask, index)) {
      row[index] = reading.reader.read(column.bits)
    }
  }
  return row
}

/** Read one changed or gone row; false when its spawn hasn't arrived. */
function readRow(reading: Reading, handle: number): boolean {
  if (reading.reader.read(ONE) === ONE) {
    reading.rows.delete(handle)
    return true
  }
  const columns = reading.table.classOf(handle)
  if (columns === undefined) {
    return false
  }
  reading.rows.set(handle, readWords(reading, columns, handle))
  reading.fresh.add(handle)
  return true
}

/** The changed and gone rows; false when one cannot apply yet. */
function readRows(reading: Reading): boolean {
  const count = reading.reader.read(COUNT_BITS)
  for (let index = ZERO; index < count; index += ONE) {
    if (!readRow(reading, reading.reader.read(HANDLE_BITS))) {
      return false
    }
  }
  return true
}

function readFreshness(reading: Reading): void {
  for (const handle of [...reading.rows.keys()].toSorted(ascending)) {
    if (!reading.fresh.has(handle) && reading.reader.read(ONE) === ONE) {
      reading.fresh.add(handle)
    }
  }
}

/** The baseline a frame names: none, held, or missing (undefined). */
function baseFor(
  table: SnapshotTable,
  tick: number,
  cell: number,
): { readonly rows: ReadonlyMap<number, Readonly<Uint32Array>> } | undefined {
  if (tick === NO_BASELINE) {
    return { rows: new Map() }
  }
  // After a travel a held frame of the same tick is another cell's: missing.
  const base = table.baseline(tick)
  return base?.cell === cell ? base : undefined
}

/** Decode one frame body raw, or undefined when it cannot apply yet. */
function decodeSnapshot(
  reader: BitSource,
  table: SnapshotTable,
): RawFrame | undefined {
  const header = {
    tick: reader.read(TICK_BITS),
    baselineTick: reader.read(TICK_BITS),
    cell: reader.read(CELL_BITS),
    lastSeq: reader.read(SEQ_BITS),
    owner: readOwner(reader, table.ownerClass),
    ride: readRide(reader, table),
  }
  const base = baseFor(table, header.baselineTick, header.cell)
  if (base === undefined) {
    return undefined
  }
  const reading: Reading = {
    reader,
    table,
    rows: new Map(base.rows),
    fresh: new Set(),
  }
  if (!readRows(reading)) {
    return undefined
  }
  readFreshness(reading)
  reader.end()
  return { ...header, rows: reading.rows, fresh: reading.fresh }
}

export { decodeSnapshot }
