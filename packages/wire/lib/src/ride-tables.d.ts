import type { WireArm } from './grammar.ts';
/** The welcome's ride law table block. */
declare function encodeRideLawTables(laws: readonly WireArm[]): Uint8Array;
/** Read a server's ride law table block, checked as local laws are. */
declare function decodeRideLawTables(bytes: Readonly<Uint8Array>): readonly WireArm[];
export { decodeRideLawTables, encodeRideLawTables };
