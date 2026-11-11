import type { BitSink } from './bit-io.ts';
import type { SnapshotInput } from './snapshot.ts';
/** Write one client's frame body. */
declare function encodeSnapshot(writer: BitSink, input: SnapshotInput): void;
export { encodeSnapshot };
