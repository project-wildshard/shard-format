import type { ReleaseClock, ReleaseLock } from './release-entries.ts';
/** Every release-rule problem with `next` against the last release `old`. */
declare function releaseProblems(old: ReleaseLock, next: ReleaseLock, clock?: ReleaseClock): readonly string[];
/** Reuse against an earlier release: every id it held keeps its name and form (removals are the last release's business). */
declare function reuseProblems(earlier: ReleaseLock, next: ReleaseLock): readonly string[];
/** A patch release (`wire-vM.m.p`, p > 0) leaves the lock byte-identical (5.5). */
declare function patchProblems(tag: string, released: string, current: string): readonly string[];
/** A parsed lock with the version fields the rules need. */
declare const isReleaseLock: (value: unknown) => value is ReleaseLock;
export { isReleaseLock, patchProblems, releaseProblems, reuseProblems };
export type { ReleaseClock, ReleaseLock } from './release-entries.ts';
