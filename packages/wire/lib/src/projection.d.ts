import type { ClassColumns } from './columns.ts';
import type { WireArm, WireClass } from './grammar.ts';
/** One local column: where its value comes from in the sender's layout. */
interface Slot {
    /** The sender column index, or -1 for a field the sender lacks. */
    readonly from: number;
    /** The sender word as the local word; identity when the nodes match. */
    readonly convert: (word: number) => number;
    /** The local word for a field the sender lacks. */
    readonly fallback: number;
}
/** One sender class projected onto a local one. */
interface ClassProjection {
    readonly local: ClassColumns;
    readonly row: readonly Slot[];
    readonly owner: readonly Slot[];
    readonly initial: readonly Slot[];
}
/** Every sender class this receiver knows, projected by id. */
declare function projectClasses(sender: readonly WireClass[], local: readonly WireClass[]): ReadonlyMap<number, ClassProjection>;
/** A sender row (or owner block) in the receiver's layout. */
declare function projectRow(slotsOf: readonly Slot[], raw: ArrayLike<number>): Float64Array;
/** A ride law projected: its word slots, and whether it seats the rider. */
interface RideProjection {
    readonly seated: boolean;
    readonly words: readonly Slot[];
}
/**
 * Each sender ride law this receiver knows: its word slots, and whether the
 * sender's law holds every one of the receiver's words. A client is never
 * seated on a mount whose law it can't read whole; the block stays raw.
 */
declare function projectRides(sender: readonly WireArm[], local: readonly WireArm[]): ReadonlyMap<number, RideProjection>;
export { projectClasses, projectRides, projectRow, type ClassProjection, type RideProjection, type Slot, };
