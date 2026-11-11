import type { WireField } from './grammar.ts';
/** Decode a table block: its top-level entries, each checked whole. */
declare function decodeTable(bytes: Readonly<Uint8Array>, start: number, end: number): readonly WireField[];
export { decodeTable };
