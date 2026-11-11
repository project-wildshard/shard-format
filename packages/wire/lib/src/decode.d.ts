import type { BitSource } from './bit-io.ts';
import type { WireNode } from './grammar.ts';
import type { WireValue } from './values.ts';
/** Read one value of the sender's node, as the receiver's node holds it. */
type Decode = (reader: BitSource) => WireValue;
/** Compile one decoder: the sender's layout, projected onto the receiver's. */
declare function compileDecoder(sender: WireNode, receiver: WireNode | undefined): Decode;
export { compileDecoder, type Decode };
