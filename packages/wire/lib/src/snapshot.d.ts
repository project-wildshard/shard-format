import type { BitSink } from './bit-io.ts';
import type { ClassColumns, Column } from './columns.ts';
/** One tick's quantised rows, as the server's frame ring holds them. */
interface RowSource {
    readonly tick: number;
    readonly data: ArrayLike<number>;
    readonly offset: (handle: number) => number | undefined;
}
/** The ride under the owner: its law's id and its words, as doubles. */
interface RideBlock {
    readonly law: number;
    readonly words: Readonly<Float64Array>;
}
/** A ride law: its id and its word count; every word is an f32. */
interface RideLaw {
    readonly id: number;
    readonly words: number;
}
/** The client's baseline: its frame, what it saw, and each row's source. */
interface SnapshotBaseline {
    readonly frame: RowSource;
    readonly visible: ReadonlySet<number>;
    /** The frame a held row's values came from; absent means `frame`. */
    readonly rowFrom?: (handle: number) => RowSource | undefined;
}
/** What one client's frame is built from (v0's `FrameInput`, by class columns). */
interface SnapshotInput {
    readonly frame: RowSource;
    readonly cell: number;
    readonly lastSeq: number;
    readonly ownerClass: ClassColumns;
    readonly owner: Readonly<Float64Array>;
    readonly ride: RideBlock | undefined;
    readonly visible: ReadonlySet<number>;
    readonly baseline: SnapshotBaseline | undefined;
    readonly due?: (handle: number) => boolean;
    readonly classOf: (handle: number) => ClassColumns | undefined;
}
/** One decoded frame, raw, in the sender's layout. */
interface RawFrame {
    readonly tick: number;
    readonly baselineTick: number;
    readonly cell: number;
    readonly lastSeq: number;
    readonly owner: Readonly<Float64Array>;
    readonly ride: RideBlock | undefined;
    readonly rows: ReadonlyMap<number, Readonly<Uint32Array>>;
    readonly fresh: ReadonlySet<number>;
}
/** What decoding needs: the sender's columns, and the receiver's held frames. */
interface SnapshotTable {
    readonly ownerClass: ClassColumns;
    readonly classOf: (handle: number) => ClassColumns | undefined;
    readonly rideLaw: (id: number) => RideLaw | undefined;
    readonly baseline: (tick: number) => RawFrame | undefined;
}
/** The baseline tick of a full frame. */
declare const NO_BASELINE = 4294967295;
declare const TICK_BITS = 32;
declare const CELL_BITS = 16;
declare const SEQ_BITS = 16;
declare const HANDLE_BITS = 16;
declare const COUNT_BITS = 16;
declare const LAW_BITS = 8;
declare const DOUBLE_BITS = 64;
declare const fullMask: (fields: number) => number;
declare const ascending: (left: number, right: number) => number;
declare const bitSet: (mask: number, index: number) => boolean;
/** A row's changed-field mask against its baseline row, if any. */
declare function rowMask(frame: RowSource, at: number, base: {
    readonly frame: RowSource | undefined;
    readonly at: number | undefined;
    readonly fields: number;
}): number;
declare function writeOwner(writer: BitSink, columns: readonly Column[], owner: Readonly<Float64Array>): void;
declare function writeRide(writer: BitSink, ride: RideBlock | undefined): void;
export { ascending, bitSet, CELL_BITS, COUNT_BITS, DOUBLE_BITS, fullMask, HANDLE_BITS, LAW_BITS, NO_BASELINE, rowMask, SEQ_BITS, TICK_BITS, writeOwner, writeRide, type RawFrame, type RideBlock, type RideLaw, type RowSource, type SnapshotBaseline, type SnapshotInput, type SnapshotTable, };
