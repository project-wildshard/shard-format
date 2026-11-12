import type { DecodedFrame, FrameInput } from '../../frozen/v0/frame.ts';
import type { NetClass } from '../../frozen/v0/schema.ts';
import type { ClassColumns } from '../../src/columns.ts';
import type { RawFrame, SnapshotInput } from '../../src/snapshot.ts';
import type { CapturedFrame } from './frame-data.ts';
/** The v1 columns of a class, by its name. */
declare function columnsNamed(name: string): ClassColumns;
/**
 * The v1 columns of a class as the recorded sender had them: its v0 class's
 * name, with only the row fields its rows carried. A v1 sender's table is its
 * own, so a row field added since a capture (REMOTE-PLAYERS RP6's `swing`,
 * `heavy` and `air`) was never in that sender's rows.
 */
declare function columnsOf(cls: Readonly<NetClass<never>>): ClassColumns;
/** A v0 frame input as a v1 snapshot input. */
declare function snapshotInput(input: Readonly<FrameInput>): SnapshotInput;
/** A v0 receiver baseline as a v1 raw frame. */
declare function rawBase(base: Readonly<DecodedFrame> | null): RawFrame | undefined;
/** A decoded frame as its receiver holds it, for the per-field-tag count. */
interface FrameSeen {
    readonly raw: RawFrame | undefined;
    readonly base: RawFrame | undefined;
    readonly owner: ClassColumns;
    readonly classOf: (handle: number) => ClassColumns | undefined;
}
/** A captured frame's v1 encode and decode, compiled once; decode by a receiver on the same tables. */
declare function frameCodec(record: Readonly<CapturedFrame>): {
    readonly input: FrameInput;
    readonly bytes: Uint8Array;
    readonly encode: () => Uint8Array<ArrayBuffer>;
    readonly decode: () => RawFrame | undefined;
    /** The receiver's view once decoded: its frame, baseline and tables. */
    readonly seen: FrameSeen;
};
/** One captured frame encoded and decoded by v1, as a receiver on the same tables. */
declare function replay(record: Readonly<CapturedFrame>): {
    readonly input: FrameInput;
    readonly raw: RawFrame | undefined;
};
export { columnsNamed, columnsOf, frameCodec, rawBase, replay, snapshotInput, type FrameSeen, };
