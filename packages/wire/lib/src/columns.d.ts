import type { WireClass, WireNode } from './grammar.ts';
/** One column: its field id, its bits on the wire, and its node. */
interface Column {
    readonly id: number;
    readonly bits: number;
    readonly node: WireNode;
}
/** A class compiled into its columns. */
interface ClassColumns {
    readonly id: number;
    readonly row: readonly Column[];
    readonly owner: readonly Column[];
    readonly initial: readonly Column[];
    readonly text: readonly number[];
}
/** A column's width: the bits its quantised word takes. */
declare function columnBits(node: WireNode): number;
/** Compile one class's columns, in its declared order. */
declare function classColumns(wireClass: WireClass): ClassColumns;
export { classColumns, columnBits, type ClassColumns, type Column };
