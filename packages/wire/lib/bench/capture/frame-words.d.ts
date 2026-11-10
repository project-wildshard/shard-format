import type { CapturedFrame } from './frame-data.ts';
declare const VERSION = 1;
interface PackedFrameWords {
    readonly version: typeof VERSION;
    readonly wordTable: readonly string[];
    readonly frames: unknown;
}
/** Dictionary only the exact bit strings; no row, callback or packet is dropped. */
declare function packFrameWords(frames: readonly CapturedFrame[]): PackedFrameWords;
/** Validate and replay every expanded frame before returning it to any timing run. */
declare function unpackFrameWords(value: unknown): readonly CapturedFrame[];
export { packFrameWords, unpackFrameWords, type PackedFrameWords };
