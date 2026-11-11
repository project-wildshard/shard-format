import type { DecodedFrame, FrameInput } from '../../frozen/v0/frame.ts';
import type { NetClass } from '../../frozen/v0/schema.ts';
import type { ClassColumns } from '../../src/columns.ts';
import type { RawFrame, SnapshotInput } from '../../src/snapshot.ts';
import type { CapturedFrame } from './frame-data.ts';
/** The v1 columns of a class, by its v0 class's name. */
declare function columnsOf(cls: Readonly<NetClass<never>>): ClassColumns;
/** A v0 frame input as a v1 snapshot input. */
declare function snapshotInput(input: Readonly<FrameInput>): SnapshotInput;
/** A v0 receiver baseline as a v1 raw frame. */
declare function rawBase(base: Readonly<DecodedFrame> | null): RawFrame | undefined;
/** A captured frame's v1 encode and decode, compiled once; decode by a receiver on the same tables. */
declare function frameCodec(record: Readonly<CapturedFrame>): {
    readonly input: FrameInput;
    readonly bytes: Uint8Array;
    readonly encode: () => Uint8Array;
    readonly decode: () => RawFrame | undefined;
};
/** One captured frame encoded and decoded by v1, as a receiver on the same tables. */
declare function replay(record: Readonly<CapturedFrame>): {
    readonly input: FrameInput;
    readonly raw: RawFrame | undefined;
};
export { columnsOf, frameCodec, rawBase, replay, snapshotInput };
