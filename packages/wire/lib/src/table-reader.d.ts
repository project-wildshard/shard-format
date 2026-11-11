/** What a table reader offers its callers. */
interface TableSource {
    readonly done: boolean;
    readonly uvarint: () => number;
    readonly count: () => number;
    readonly f64: () => number;
    readonly word: () => string;
    readonly tick: (depth: number) => void;
}
/** Reads one table block, `bytes[start, end)`. */
declare class TableReader implements TableSource {
    private at;
    private nodes;
    private readonly bytes;
    private readonly end;
    constructor(bytes: Readonly<Uint8Array>, start: number, end: number);
    /** Whether every byte was read. */
    get done(): boolean;
    uvarint(): number;
    /** A count of fields, arms or words: at most 255. */
    count(): number;
    f64(): number;
    word(): string;
    /** Count one node at `depth`, refusing a table too deep or too large. */
    tick(depth: number): void;
}
/** The bounds a peer's table must keep; part of the v1 contract (a raise is a major). */
declare const TABLE_LIMITS: {
    readonly maxDepth: 8;
    readonly maxCount: 255;
    readonly maxNodes: 4096;
};
export { TABLE_LIMITS, TableReader, type TableSource };
