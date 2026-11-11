import type { WireField, WireNode } from './grammar.ts';
import type { TableSource } from './table-reader.ts';
/** Read one node and everything inside it. */
declare function readNode(reader: TableSource, depth: number): WireNode;
/** Decode a table block: its top-level entries, each checked whole. */
declare function decodeTable(bytes: Readonly<Uint8Array>, start: number, end: number): readonly WireField[];
export { decodeTable, readNode };
