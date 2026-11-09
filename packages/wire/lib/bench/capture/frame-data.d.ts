interface CapturedRow {
    readonly handle: number;
    readonly classId: number;
    readonly words: string;
}
interface Snapshot {
    readonly tick: number;
    readonly rows: readonly CapturedRow[];
}
interface RowCall {
    readonly handle: number;
    readonly source?: Snapshot | undefined;
}
interface DueCall {
    readonly handle: number;
    readonly value: boolean;
}
interface CapturedBaseline {
    readonly frame: Snapshot;
    readonly visible: readonly number[];
    readonly hasRowFrom: boolean;
}
interface CapturedFrame {
    readonly frame: Snapshot;
    readonly cell: number;
    readonly lastSeq: number;
    readonly ownerClass: number;
    readonly owner: string;
    readonly ride?: string | undefined;
    readonly rideWords?: number | undefined;
    readonly visible: readonly number[];
    readonly baseline?: CapturedBaseline | undefined;
    readonly classes: readonly {
        readonly handle: number;
        readonly id: number;
    }[];
    readonly hasDue: boolean;
    readonly rowFromCalls: readonly RowCall[];
    readonly dueCalls: readonly DueCall[];
    readonly bytes: string;
}
declare function bytesText(bytes: Readonly<Uint8Array>): string;
declare function textBytes(text: string): Uint8Array;
declare function packWords(words: Readonly<ArrayLike<number>>): string;
declare function unpackWords(text: string): Uint32Array;
declare function packDoubles(values: Readonly<Float64Array>): string;
declare function unpackDoubles(text: string): Float64Array;
declare function parseFrameCapture(value: unknown): CapturedFrame;
export { bytesText, textBytes, packWords, unpackWords, packDoubles, unpackDoubles, parseFrameCapture, type CapturedRow, type Snapshot, type RowCall, type DueCall, type CapturedFrame, };
