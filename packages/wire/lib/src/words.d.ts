import type { WireNode } from './grammar.ts';
/** A column word read as a value, and a value written as a word. */
interface WordCodec {
    readonly toValue: (word: number) => number | string;
    readonly toWord: (value: number | string) => number;
    /** The word of the node's default. */
    readonly fallback: number;
}
/** How a column of this node reads and writes its words. */
declare function wordCodec(node: WireNode): WordCodec;
export { wordCodec, type WordCodec };
