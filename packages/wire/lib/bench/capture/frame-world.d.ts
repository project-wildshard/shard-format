import { WorldFrame } from '../../frozen/v0/frame.ts';
import { V0_CLASSES } from '../../frozen/v0/tables.ts';
import type { Snapshot } from './frame-data.ts';
interface FrameView {
    readonly tick: number;
    readonly data: Readonly<Uint32Array>;
    readonly offset: (handle: number) => number | undefined;
}
interface ClassView {
    readonly id: number;
    readonly row: readonly {
        readonly bits: number;
    }[];
}
declare function frozenClass(id: number): (typeof V0_CLASSES)[number];
declare function snapshot(frame: FrameView, handles: readonly number[], classes: ReadonlyMap<number, number>): Snapshot;
declare class CapturedWorld {
    private readonly frame;
    read(data: Snapshot): WorldFrame;
}
declare function world(data: Snapshot): WorldFrame;
declare function missingBaseline(): null;
export { CapturedWorld, frozenClass, snapshot, world, missingBaseline, type FrameView, type ClassView, };
