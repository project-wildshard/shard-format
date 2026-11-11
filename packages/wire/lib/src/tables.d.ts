import type { ByteSink } from './bit-io.ts';
import type { WireField, WireNode } from './grammar.ts';
/** A node kind's code in a table: its index here, plus one. */
declare const KIND_CODES: readonly ['uint', 'bool', 'f32', 'f64', 'quant', 'fixed', 'angle', 'enum', 'ref', 'text', 'optional', 'array', 'struct', 'union'];
declare const FIRST_CODE = 1;
declare const unzigzag: (value: number) => number;
/** Append one node's table form: its kind code, then its body. */
declare function writeNode(out: ByteSink, node: WireNode): void;
/** A table: its top-level entries, each an id and a node. */
declare function encodeTable(entries: readonly WireField[]): Uint8Array<ArrayBuffer>;
export { encodeTable, FIRST_CODE, KIND_CODES, unzigzag, writeNode };
