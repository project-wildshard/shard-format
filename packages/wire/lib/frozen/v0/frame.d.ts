import { type BitWriter } from './bits.ts';
import type { NetClass } from './schema.ts';
/** The baseline tick of a full frame. */
export declare const NO_BASELINE = 4294967295;
/** World frames the server keeps: about a second at 30 Hz. An ack older than this gets a full frame. */
export declare const FRAME_RING = 32;
/** One snapshot tick's quantised rows, flat, reused from the ring so a frame allocates nothing once warm. */
export declare class WorldFrame {
    tick: number;
    data: Uint32Array;
    private used;
    private readonly offsets;
    /** Empty this slot for a new tick. */
    reset(tick: number): void;
    /** Reserve one handle's row; the caller fills `length` values from the returned offset. */
    claim(handle: number, length: number): number;
    /** Where a handle's row starts, or undefined if it was not in this frame. */
    offset(handle: number): number | undefined;
    /** Every handle in this frame. */
    handles(): Iterable<number>;
}
/** The last FRAME_RING world frames. */
export declare class WorldFrameRing {
    private readonly slots;
    private next;
    /** The oldest slot, emptied for `tick`. */
    claim(tick: number): WorldFrame;
    /** The frame of `tick` if it is still held. */
    at(tick: number): WorldFrame | null;
}
/** What one client's frame is built from. */
export interface FrameInput {
    readonly frame: WorldFrame;
    readonly cell: number;
    readonly lastSeq: number;
    readonly ownerClass: NetClass<never>;
    readonly owner: Float64Array;
    /** The first `rideWords` of this are the ride under the owner (P1-E5.3-D3): flat words only its law reads. Absent or 0: on foot, and it costs one bit. */
    readonly ride?: Float64Array;
    readonly rideWords?: number;
    /** The handles this client should see now, and the same set as of its baseline. */
    readonly visible: ReadonlySet<number>;
    /** `rowFrom` is the world frame a baseline row's values came from: its tier may have left it older than the baseline. */
    readonly baseline: {
        readonly frame: WorldFrame;
        readonly visible: ReadonlySet<number>;
        readonly rowFrom?: (handle: number) => WorldFrame | null;
    } | null;
    /** Whether a row the baseline holds is sent this frame; left out, the client keeps it (§3.3). Absent, all are. */
    readonly due?: (handle: number) => boolean;
    readonly classOf: (handle: number) => NetClass<never> | undefined;
}
/** Write one client's frame: header, owner block, then only the rows that changed since its baseline. */
export declare function encodeFrame(writer: BitWriter, input: FrameInput): ArrayBuffer;
/** One decoded frame: the owner block and every visible row, whole, quantised. */
export interface DecodedFrame {
    readonly tick: number;
    readonly baselineTick: number;
    readonly cell: number;
    readonly lastSeq: number;
    readonly owner: Float64Array;
    readonly rows: Map<number, Uint32Array>;
    /** The ride under this client's player, or null on foot. */
    readonly ride: Float64Array | null;
    /** The rows that are a true sample of this tick, sent or standing still. Any other row is a held copy of an older one. */
    readonly fresh: ReadonlySet<number>;
}
/** What decoding needs from the receiver. */
export interface FrameTable {
    readonly ownerClass: NetClass<never>;
    readonly classOf: (handle: number) => NetClass<never> | undefined;
    readonly baseline: (tick: number) => DecodedFrame | null;
}
/** Decode a frame. Malformed bytes or a frame that cannot apply yet give null; nothing throws past this boundary. */
export declare function decodeFrame(bytes: Uint8Array, table: FrameTable): DecodedFrame | null;
