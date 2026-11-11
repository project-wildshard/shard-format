// `wire check`'s release rules (WIRE-STABILITY 5.5 and 7, row WR6): the lock
// now against the lock at the last `wire-vM.m.0` tag. Ids are append-only:
// one never changes name, form or bounds once released, a removal waits for
// its deprecation window and leaves its id reserved, a required field is
// never removed in a minor, an addition needs a minor bump, and what ids
// can't express (limits) needs a major. Unreleased ids are free.
const NONE = 0;
const ONE = 1;
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
/** What only a major may change: a peer can't read past them (5.5). */
const MAJOR_KEYS = ['maxRowFields', 'tableLimits', 'v0SchemaHash'];
/** Keys that describe an entry's children, compared child by child. */
const NESTED = new Set(['fields', 'arms', 'node']);
/** Keys a release may change on a released id: its history. */
const HISTORY = new Set(['since', 'deprecated']);
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isEntry = (value) => isRecord(value) &&
    typeof value['id'] === 'number' &&
    typeof value['name'] === 'string';
/** A list's entries with ids; a non-list is empty. */
function entriesOf(value) {
    return Array.isArray(value)
        ? value.filter((item) => isEntry(item))
        : [];
}
/** An entry's own facts: everything but its children and its history. */
function ownFacts(entry) {
    const own = Object.entries(entry).filter(([key]) => !NESTED.has(key) && !HISTORY.has(key));
    return JSON.stringify(Object.fromEntries(own));
}
/** The entries a struct or union holds (its fields, or its arms), and its node. */
function childrenOf(entry) {
    const { node, fields, arms } = entry;
    return {
        fields: entriesOf(fields ?? arms),
        node: isRecord(node) ? node : undefined,
    };
}
/** A released entry that left: allowed only after its window, never if required. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a diff collects its problems
function removed(diff, path, entry) {
    const { deprecated, required } = entry;
    if (required === true) {
        diff.problems.push(`${path} is required and was removed (5.5)`);
    }
    else if (typeof deprecated !== 'number' || diff.minor < deprecated + ONE) {
        diff.problems.push(`${path} was removed inside its deprecation window (5.5)`);
    }
}
/** A list's entries by id; a duplicate is a problem. */
function byId(
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a diff collects its problems
diff, path, after) {
    const now = new Map(after.map((entry) => [
        entry.id,
        entry,
    ]));
    if (now.size < after.length) {
        diff.problems.push(`${path} holds a duplicate id (5.2)`);
    }
    return now;
}
/** How many entries `after` adds to `before`. */
const addedTo = (before, after) => {
    const released = new Set(before.map((entry) => entry.id));
    return after.filter((entry) => !released.has(entry.id))
        .length;
};
/** Compare two lists of entries, id by id. */
function compareLists(
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a diff collects its problems
diff, path, lists) {
    const [before, after] = lists;
    const now = byId(diff, path, after);
    for (const old of before) {
        const next = now.get(old.id);
        const at = `${path}#${String(old.id)} ${old.name}`;
        if (next === undefined) {
            removed(diff, at, old);
        }
        else {
            // oxlint-disable-next-line no-use-before-define -- entries nest
            compareEntries(diff, at, [old, next]);
        }
    }
    diff.added += addedTo(before, after);
}
/** Why a released entry may not become its successor, if it may not. */
function formProblem(path, old, next) {
    const [was, is] = [old['name'], next['name']];
    if (was !== is) {
        return `${path} was renamed to ${String(is)}: a released id keeps its name (5.5)`;
    }
    return ownFacts(old) === ownFacts(next)
        ? undefined
        : `${path} changed form or bounds: a released id is retyped as a new id plus a deprecation (5.5)`;
}
/** Compare one released entry with its successor: same name and form; children recursively. */
function compareEntries(
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a diff collects its problems
diff, path, pair) {
    const [old, next] = pair;
    const problem = formProblem(path, old, next);
    if (problem !== undefined) {
        diff.problems.push(problem);
        return;
    }
    const [mine, theirs] = [childrenOf(old), childrenOf(next)];
    compareLists(diff, path, [mine.fields, theirs.fields]);
    if (mine.node !== undefined && theirs.node !== undefined) {
        compareEntries(diff, `${path}.node`, [mine.node, theirs.node]);
    }
}
/** A space's reserved ids, used again. */
function reservedProblems(path, reserved, after) {
    const held = new Set(Array.isArray(reserved) ? reserved : []);
    return after
        .filter((entry) => held.has(entry.id))
        .map((entry) => `${path}#${String(entry.id)} is reserved and may not be used again (5.5)`);
}
/** Compare every id space and node of two locks. */
function compareSpaces(
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a diff collects its problems
diff, locks) {
    const [old, next] = locks;
    const reserved = isRecord(next['reserved']) ? next['reserved'] : {};
    for (const space of SPACES) {
        compareLists(diff, space, [entriesOf(old[space]), entriesOf(next[space])]);
        diff.problems.push(...reservedProblems(space, reserved[space], entriesOf(next[space])));
    }
    for (const key of NODES) {
        const [mine, theirs] = [old[key], next[key]];
        if (isRecord(mine) && isRecord(theirs)) {
            compareEntries(diff, key, [mine, theirs]);
        }
    }
}
/** The version rules: limits need a major; additions need a minor. */
function versionProblems(old, next, added) {
    const sameMajor = next.wireMajor === old.wireMajor;
    const limits = MAJOR_KEYS.some((key) => JSON.stringify(old[key]) !== JSON.stringify(next[key]));
    return [
        ...(limits && sameMajor
            ? ['a major-level change (limits) needs a WIRE_MAJOR bump (5.5)']
            : []),
        ...(added > NONE && sameMajor && next.wireMinor <= old.wireMinor
            ? [
                `${String(added)} addition(s) since the release need WIRE_MINOR above ${String(old.wireMinor)} (5.5)`,
            ]
            : []),
    ];
}
/** Every release-rule problem with `next` against the released `old`. */
function releaseProblems(old, next) {
    const diff = { problems: [], minor: next.wireMinor, added: NONE };
    compareSpaces(diff, [old, next]);
    return [...diff.problems, ...versionProblems(old, next, diff.added)];
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
export { isReleaseLock, patchProblems, releaseProblems };
