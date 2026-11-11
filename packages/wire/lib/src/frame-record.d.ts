import type { Span } from './bit-io.ts';
import type { RawFrame, SnapshotInput, SnapshotTable } from './snapshot.ts';
declare const TAG_FRAME = 5;
/** One client's frame message. */
declare function encodeFrame(input: SnapshotInput): Uint8Array;
/** A frame record's body, raw, or undefined when it cannot apply yet. */
declare function decodeFrame(span: Span, table: SnapshotTable): RawFrame | undefined;
/** A frame message's one frame record, decoded raw, or undefined when it cannot apply yet. */
declare function decodeFrameMessage(bytes: Readonly<Uint8Array>, table: SnapshotTable): RawFrame | undefined;
/** Which capabilities a welcome selects, and whether the client can play. */
interface Capabilities {
    readonly selected: readonly number[];
    readonly missing: readonly number[];
}
/** The server's side: the intersection, and the required ones a client lacks. */
declare function selectCapabilities(client: readonly number[], server: readonly number[], required: readonly number[]): Capabilities;
export { decodeFrame, decodeFrameMessage, encodeFrame, selectCapabilities, TAG_FRAME, type Capabilities, };
