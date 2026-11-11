import type { BitSink } from './bit-io.ts';
import type { WireNode } from './grammar.ts';
import type { WireValue } from './values.ts';
/** Write one value of one node. */
type Encode = (writer: BitSink, value: WireValue) => void;
/** Bits for a count of 0 to `maxCount`. */
declare function countBits(maxCount: number): number;
/** Bits for an index into `size` values. */
declare function indexBits(size: number): number;
/** Compile one node's encoder. */
declare function compileEncoder(node: WireNode): Encode;
export { compileEncoder, countBits, indexBits, type Encode };
