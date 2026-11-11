// `wire check`'s release rules (WIRE-STABILITY 5.5 and 7, row WR6), as Opus
// reviewed them. The lock now against the lock at the last `wire-vM.m.0`
// release reachable from HEAD, and against every earlier release for reuse:
// - a released id keeps its name and form (bounds, default, send, predicted,
//   required) for good, in any release, so a removed id never comes back
//   meaning something else; an enum may only append values;
// - a removal waits for its deprecation: one minor and 14 days after the
//   minor that deprecated it; a required field leaves only in a major; a
//   removed top-level id joins its space's `reserved` list, and a reserved id
//   is never live;
// - `since` never changes; `deprecated` may be added, never moved or dropped;
// - any lock change needs a minor above the release's, and a new node kind,
//   a new key on a kind, or a limit change needs a major; versions never fall.
// Ids added since the release are free (release-scoped strictness).
// The entry rules live in release-entries.ts and the version rules in
// release-grammar.ts; this module walks a lock's spaces through them.
import { compareEntries, compareLists, childrenOf, entriesOf, isRecord, } from './release-entries.js';
import { versionProblems } from './release-grammar.js';
const NONE = 0;
/** The id spaces a lock holds, each a list of entries with ids. */
const SPACES = [
    'messages',
    'cold',
    'records',
    'events',
    'classes',
    'capabilities',
    'rideLaws',
];
/** Single nodes whose children are compared id by id. */
const NODES = ['acts', 'command'];
/** Spaces whose removed ids must join the lock's `reserved` list. */
const RESERVED = [
    'messages',
    'events',
    'acts',
    'classes',
    'capabilities',
    'rideLaws',
];
/** The id spaces as a set, to tell a space from a node. */
const SPACE_NAMES = new Set(SPACES);
/** A space's reserved ids: none live, the released ones kept, every removed top-level id added. */
function reservedProblems(path, locks, lists) {
    const listOf = (lock) => {
        const reserved = isRecord(lock['reserved'])
            ? lock['reserved'][path]
            : undefined;
        return new Set(Array.isArray(reserved) ? reserved : []);
    };
    const [oldLock, nextLock] = locks;
    const [before, after] = lists;
    const [was, is] = [listOf(oldLock), listOf(nextLock)];
    const live = new Set(after.map((entry) => entry.id));
    const removedIds = before
        .map((entry) => entry.id)
        .filter((id) => !live.has(id));
    return [
        ...[...is]
            .filter((id) => typeof id === 'number' && live.has(id))
            .map((id) => `${path}#${String(id)} is reserved and may not be used again (5.5)`),
        ...[...was]
            .filter((id) => !is.has(id))
            .map((id) => `${path}#${String(id)} left the reserved list: reserved is for good (5.5)`),
        ...removedIds
            .filter((id) => !is.has(id))
            .map((id) => `${path}#${String(id)} was removed without joining reserved (5.5)`),
    ];
}
/** The arms or fields a single node holds, for its reserved list. */
const nodeEntries = (lock, key) => {
    const node = lock[key];
    return isRecord(node) ? childrenOf(node).fields : [];
};
/** Compare every id space and node of two locks. */
function compareSpaces(
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a diff collects its problems
diff, locks) {
    const [old, next] = locks;
    for (const space of SPACES) {
        compareLists(diff, space, [entriesOf(old[space]), entriesOf(next[space])]);
    }
    for (const key of NODES) {
        const [mine, theirs] = [old[key], next[key]];
        if (isRecord(mine) && isRecord(theirs)) {
            compareEntries(diff, key, [mine, theirs]);
        }
    }
}
/** The reserved-list rules for every space that keeps one, against the last release only. */
function reservedSpaces(locks) {
    const [old, next] = locks;
    return RESERVED.flatMap((space) => {
        const lists = SPACE_NAMES.has(space)
            ? [entriesOf(old[space]), entriesOf(next[space])]
            : [nodeEntries(old, space), nodeEntries(next, space)];
        return reservedProblems(space, locks, lists);
    });
}
/** Every release-rule problem with `next` against the last release `old`. */
function releaseProblems(old, next, clock) {
    const major = next.wireMajor > old.wireMajor;
    const diff = {
        problems: [],
        minor: next.wireMinor,
        major,
        clock,
        added: NONE,
    };
    compareSpaces(diff, [old, next]);
    return [
        ...diff.problems,
        ...reservedSpaces([old, next]),
        ...versionProblems(old, next),
    ];
}
/** Reuse against an earlier release: every id it held keeps its name and form (removals are the last release's business). */
function reuseProblems(earlier, next) {
    const diff = {
        problems: [],
        minor: next.wireMinor,
        major: true,
        clock: undefined,
        added: NONE,
    };
    // Reserved lists are the last release's business; reuse is about names and forms.
    compareSpaces(diff, [earlier, next]);
    return diff.problems;
}
/** A patch release (`wire-vM.m.p`, p > 0) leaves the lock byte-identical (5.5). */
function patchProblems(tag, released, current) {
    const patch = /^wire-v\d+\.\d+\.(?<patch>\d+)$/u.exec(tag)?.groups?.['patch'];
    return patch !== undefined && Number(patch) > NONE && released !== current
        ? [`${tag} is a patch tag and the lock changed since the minor (5.5)`]
        : [];
}
/** A parsed lock with the version fields the rules need. */
const isReleaseLock = (value) => isRecord(value) &&
    typeof value['wireMajor'] === 'number' &&
    typeof value['wireMinor'] === 'number';
export { isReleaseLock, patchProblems, releaseProblems, reuseProblems };
