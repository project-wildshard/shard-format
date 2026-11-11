import type { BitSource } from './bit-io.ts';
import type { RawFrame, SnapshotTable } from './snapshot.ts';
/** Decode one frame body raw, or undefined when it cannot apply yet. */
declare function decodeSnapshot(reader: BitSource, table: SnapshotTable): RawFrame | undefined;
export { decodeSnapshot };
