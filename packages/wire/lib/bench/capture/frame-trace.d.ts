import type { CapturedFrame } from './frame-data.ts';
import type { FrameView, ClassView } from './frame-world.ts';
interface FrameCaptureInput {
    readonly frame: FrameView;
    readonly cell: number;
    readonly lastSeq: number;
    readonly ownerClass: {
        readonly id: number;
    };
    readonly owner: Readonly<Float64Array>;
    readonly ride?: Readonly<Float64Array>;
    readonly rideWords?: number;
    readonly visible: ReadonlySet<number>;
    readonly baseline: {
        readonly frame: FrameView;
        readonly visible: ReadonlySet<number>;
        readonly rowFrom?: (handle: number) => FrameView | null;
    } | null;
    readonly due?: (handle: number) => boolean;
}
/** Tee actual callback calls; never re-evaluate rowFrom or due after encode. */
declare class FrameTrace {
    private readonly classes;
    private readonly rows;
    private readonly dues;
    recordClass<Class extends ClassView | undefined>(handle: number, cls: Class): Class;
    recordRowFrom<Frame extends FrameView | null>(handle: number, frame: Frame): Frame;
    recordDue(handle: number, value: boolean): boolean;
    private record;
    /** Mandatory byte oracle before a record can reach the recording or gate. */
    finish(input: FrameCaptureInput, bytes: ArrayBuffer): CapturedFrame;
}
export { FrameTrace, type FrameCaptureInput };
