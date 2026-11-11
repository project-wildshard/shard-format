/** A lock entry or node, as the lock writes it. */
type LockRecord = Readonly<Record<string, unknown>>;
/** A lock entry with an id: a message, record, field, arm, class or law. */
interface LockEntry extends LockRecord {
    readonly id: number;
    readonly name: string;
}
/** The parts of a lock the release rules read. */
interface ReleaseLock extends LockRecord {
    readonly wireMajor: number;
    readonly wireMinor: number;
}
/** When each released minor of this major was tagged, and now (both in seconds); absent skips the 14-day rule. */
interface ReleaseClock {
    readonly releasedAt: (minor: number) => number | undefined;
    readonly now: number;
}
/** One diff: what it found, and what it may relax. */
interface Diff {
    readonly problems: string[];
    readonly minor: number;
    readonly major: boolean;
    readonly clock: ReleaseClock | undefined;
    added: number;
}
declare const isRecord: (value: unknown) => value is LockRecord;
/** A list's entries with ids; a non-list is empty. */
declare function entriesOf(value: unknown): readonly LockEntry[];
/** The entries a struct or union holds (its fields, or its arms), and its node. */
declare function childrenOf(entry: LockRecord): {
    readonly fields: readonly LockEntry[];
    readonly node: LockRecord | undefined;
};
/** Compare two lists of entries, id by id. */
declare function compareLists(diff: Diff, path: string, lists: readonly [readonly LockEntry[], readonly LockEntry[]]): void;
/** Compare one released entry with its successor: same name and form; children recursively. */
declare function compareEntries(diff: Diff, path: string, pair: readonly [LockRecord, LockRecord]): void;
export { childrenOf, compareEntries, compareLists, entriesOf, isRecord, type Diff, type LockEntry, type LockRecord, type ReleaseClock, type ReleaseLock, };
