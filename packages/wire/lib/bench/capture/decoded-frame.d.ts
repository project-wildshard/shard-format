import type { CapturedFrame } from './frame-data.ts';
interface DecodedView {
    readonly tick: number;
    readonly cell: number;
    readonly lastSeq: number;
    readonly rows: ReadonlyMap<number, Readonly<Uint32Array>>;
    readonly owner: Readonly<Float64Array>;
    readonly ride: Readonly<Float64Array> | null;
}
/** Validate real receiver state before measuring, including older held rows. */
declare function assertDecodedFrame(record: CapturedFrame, decoded: DecodedView): void;
export { assertDecodedFrame };
