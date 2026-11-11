import type { BitSink } from './bit-io.ts';
import type { WireField, WireNode } from './grammar.ts';
import type { WireValue } from './values.ts';
/** Write one value of one node (as `encode.ts`'s `Encode`). */
type Encode = (writer: BitSink, value: WireValue) => void;
/** The closures a generated body calls by index. */
type Fallback = (node: WireNode) => Encode;
/** One struct's encoder as a single generated function; undefined under a CSP. */
declare function generateStructEncoder(fields: readonly WireField[], fallback: Fallback): Encode | undefined;
export { generateStructEncoder };
