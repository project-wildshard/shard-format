import { BitWriter } from '../../frozen/v0/bits.ts';
import type { DecodedFrame, FrameInput } from '../../frozen/v0/frame.ts';
import type { CapturedFrame } from './frame-data.ts';
interface PreparedFrame {
    readonly bytes: Readonly<Uint8Array>;
    readonly encode: (writer: () => BitWriter) => ArrayBuffer;
    readonly decode: () => DecodedFrame;
}
declare function inputOf(record: CapturedFrame): FrameInput;
declare function receiverBase(record: CapturedFrame): DecodedFrame | null;
/** Inflate fixtures before timing. Timed encode still includes frozen framing,
 * per-handle dispatch, output allocation/copy and writer clearing. */
declare function prepareFrame(record: CapturedFrame): PreparedFrame;
export { inputOf, prepareFrame, receiverBase, type PreparedFrame };
