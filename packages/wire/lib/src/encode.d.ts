import type { BitSink } from './bit-io.ts';
import type { WireNode } from './grammar.ts';
import type { WireValue } from './values.ts';
/** Write one value of one node. */
type Encode = (writer: BitSink, value: WireValue) => void;
/** Compile one node's encoder. */
declare function compileEncoder(node: WireNode): Encode;
export { countBits, indexBits } from './bounds.ts';
export { compileEncoder, type Encode };
