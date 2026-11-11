import type { WireField, WireNode } from './grammar.ts';
interface Identified {
    readonly id: number;
    readonly name: string;
}
/** Ids that are not positive integers, or that repeat in one space. */
declare function checkSpace(space: string, entries: readonly Identified[]): readonly string[];
/** The fields of a struct, record or arm: their ids, then each node. */
declare function checkFields(where: string, fields: readonly WireField[]): readonly string[];
/** One node and everything inside it. */
declare function checkNode(where: string, node: WireNode): readonly string[];
/** Everything wrong with one node, as a peer's table must be checked. */
declare function nodeProblems(where: string, node: WireNode): readonly string[];
export { checkFields, checkNode, checkSpace, nodeProblems, type Identified };
