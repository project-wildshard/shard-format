import type { CapturedFrame } from './frame-data.ts';
declare function replayCapturedFrame(record: CapturedFrame): ArrayBuffer;
declare function assertFrameReplay(record: CapturedFrame): void;
export { replayCapturedFrame, assertFrameReplay };
