/** A lock entry or node, as the lock writes it. */
type LockRecord = Readonly<Record<string, unknown>>;
/** The parts of a lock the release rules read. */
interface ReleaseLock extends LockRecord {
    readonly wireMajor: number;
    readonly wireMinor: number;
}
/** Every release-rule problem with `next` against the released `old`. */
declare function releaseProblems(old: ReleaseLock, next: ReleaseLock): readonly string[];
/** A patch release (`wire-vM.m.p`, p > 0) leaves the lock byte-identical (5.5). */
declare function patchProblems(tag: string, released: string, current: string): readonly string[];
/** A parsed lock with the version fields the rules need. */
declare const isReleaseLock: (value: unknown) => value is ReleaseLock;
export { isReleaseLock, patchProblems, releaseProblems, type ReleaseLock };
