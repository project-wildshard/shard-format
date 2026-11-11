import type { BitSink } from './bit-io.ts'
import type { ClassColumns, Column } from './columns.ts'

// WIRE-STABILITY 5.4: a v1 frame keeps v0's shape. The sender writes in its
// own layout: the header, the owner block whole (doubles for f64, J140), the
// ride under the owner by its law, then per changed handle the handle, the
// gone bit, a mask as wide as the sender's row and the changed columns, then
// one freshness bit per unchanged held row in ascending handle order. The
// receiver keeps every row raw, in the sender's layout, even of a class or
// column it has no slot for: dropping one would shift every later bit.

/** One tick's quantised rows, as the server's frame ring holds them. */
interface RowSource {
  readonly tick: number
  readonly data: ArrayLike<number>
  readonly offset: (handle: number) => number | undefined
}
/** The ride under the owner: its law's id and its words, as doubles. */
interface RideBlock {
  readonly law: number
  readonly words: Readonly<Float64Array>
}
/** A ride law: its id and its word count; every word is an f32. */
interface RideLaw {
  readonly id: number
  readonly words: number
}
/** The client's baseline: its frame, what it saw, and each row's source. */
interface SnapshotBaseline {
  readonly frame: RowSource
  readonly visible: ReadonlySet<number>
  /** The frame a held row's values came from; absent means `frame`. */
  readonly rowFrom?: (handle: number) => RowSource | undefined
}
/** What one client's frame is built from (v0's `FrameInput`, by class columns). */
interface SnapshotInput {
  readonly frame: RowSource
  readonly cell: number
  readonly lastSeq: number
  readonly ownerClass: ClassColumns
  readonly owner: Readonly<Float64Array>
  readonly ride: RideBlock | undefined
  readonly visible: ReadonlySet<number>
  readonly baseline: SnapshotBaseline | undefined
  readonly due?: (handle: number) => boolean
  readonly classOf: (handle: number) => ClassColumns | undefined
}
/** One decoded frame, raw, in the sender's layout. */
interface RawFrame {
  readonly tick: number
  readonly baselineTick: number
  readonly cell: number
  readonly lastSeq: number
  readonly owner: Readonly<Float64Array>
  readonly ride: RideBlock | undefined
  readonly rows: ReadonlyMap<number, Readonly<Uint32Array>>
  readonly fresh: ReadonlySet<number>
}
/** What decoding needs: the sender's columns, and the receiver's held frames. */
interface SnapshotTable {
  readonly ownerClass: ClassColumns
  readonly classOf: (handle: number) => ClassColumns | undefined
  readonly rideLaw: (id: number) => RideLaw | undefined
  readonly baseline: (tick: number) => RawFrame | undefined
}

/** The baseline tick of a full frame. */
const NO_BASELINE = 4_294_967_295
const ZERO = 0
const ONE = 1
const TWO = 2
const TICK_BITS = 32
const CELL_BITS = 16
const SEQ_BITS = 16
const HANDLE_BITS = 16
const COUNT_BITS = 16
const LAW_BITS = 8
const DOUBLE_BITS = 64
const MAX_MASK_BITS = 32

const fullMask = (fields: number): number =>
  fields >= MAX_MASK_BITS ? NO_BASELINE : TWO ** fields - ONE
const ascending = (left: number, right: number): number => left - right
const bitSet = (mask: number, index: number): boolean =>
  Math.floor(mask / TWO ** index) % TWO === ONE

/** A row's changed-field mask against its baseline row, if any. */
function rowMask(
  frame: RowSource,
  at: number,
  base: {
    readonly frame: RowSource | undefined
    readonly at: number | undefined
    readonly fields: number
  },
): number {
  if (base.frame === undefined || base.at === undefined) {
    return fullMask(base.fields)
  }
  const offset = base.at - at
  const held = base.frame.data
  let mask = ZERO
  for (let bit = ONE, index = ZERO; index < base.fields; index += ONE) {
    mask += frame.data[at + index] === held[offset + at + index] ? ZERO : bit
    bit *= TWO
  }
  return mask
}

function writeOwner(
  writer: BitSink,
  columns: readonly Column[],
  owner: Readonly<Float64Array>,
): void {
  // An index loop: `entries()` allocates per column, and this runs per frame (WB2).
  const count = columns.length
  for (let index = ZERO; index < count; index += ONE) {
    const column = columns[index]
    if (column === undefined) {
      throw new RangeError(`A class has no owner column ${String(index)}`)
    }
    const { bits } = column
    const value = owner[index] ?? ZERO
    if (bits === DOUBLE_BITS) {
      writer.writeF64(value)
    } else {
      writer.write(value, bits)
    }
  }
}

function writeRide(writer: BitSink, ride: RideBlock | undefined): void {
  writer.write(ride === undefined ? ZERO : ONE, ONE)
  if (ride !== undefined) {
    writer.write(ride.law, LAW_BITS)
    for (const word of ride.words) {
      writer.writeF32(word)
    }
  }
}

export {
  ascending,
  bitSet,
  CELL_BITS,
  COUNT_BITS,
  DOUBLE_BITS,
  fullMask,
  HANDLE_BITS,
  LAW_BITS,
  NO_BASELINE,
  rowMask,
  SEQ_BITS,
  TICK_BITS,
  writeOwner,
  writeRide,
  type RawFrame,
  type RideBlock,
  type RideLaw,
  type RowSource,
  type SnapshotBaseline,
  type SnapshotInput,
  type SnapshotTable,
}
