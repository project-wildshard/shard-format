// The entry half of `wire check`'s release rules (row WR6): a released list
// of entries against its successor, id by id. A released id keeps its name,
// form and history; a removal waits out its deprecation window; an enum only
// appends. release.ts walks the lock's spaces through these.
const NONE = 0;
const ONE = 1;
const WINDOW_SECONDS = 1_209_600;
/** Keys that describe an entry's children, compared child by child. */
const NESTED = new Set(['fields', 'arms', 'node', 'values']);
/** Keys with their own rules: history. */
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
/** The keys whose values differ between two entries' own facts. */
function changedKeys(old, next) {
    const keys = new Set([...Object.keys(old), ...Object.keys(next)]);
    return [...keys].filter((key) => !NESTED.has(key) &&
        !HISTORY.has(key) &&
        JSON.stringify(old[key]) !== JSON.stringify(next[key]));
}
/** The entries a struct or union holds (its fields, or its arms), and its node. */
function childrenOf(entry) {
    const { node, fields, arms } = entry;
    return {
        fields: entriesOf(fields ?? arms),
        node: isRecord(node) ? node : undefined,
    };
}
/** Whether `deprecated` minor's 14 days have run, when the clock is known. */
function windowOpen(diff, deprecated) {
    if (diff.minor < deprecated + ONE) {
        return false;
    }
    const at = diff.clock?.releasedAt(deprecated);
    return (diff.clock === undefined ||
        (at !== undefined && diff.clock.now - at >= WINDOW_SECONDS));
}
/** A released entry that left: after its window, never if required, except in a major. */
function removed(
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a diff collects its problems
diff, path, entry) {
    const { deprecated, required } = entry;
    if (diff.major) {
        return;
    }
    if (required === true) {
        diff.problems.push(`${path} is required and was removed: only a major removes one (5.5)`);
    }
    else if (typeof deprecated !== 'number' || !windowOpen(diff, deprecated)) {
        diff.problems.push(`${path} was removed inside its deprecation window (one minor and 14 days, 5.5)`);
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
/** An enum may append values (a minor), never reorder or drop one. */
function compareValues(
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a diff collects its problems
diff, path, pair) {
    const [old, next] = pair;
    const [was, is] = [old['values'], next['values']];
    if (!Array.isArray(was) || !Array.isArray(is)) {
        return;
    }
    const prefix = was.every((value, at) => is[at] === value);
    if (prefix && is.length >= was.length) {
        diff.added += is.length - was.length;
    }
    else {
        diff.problems.push(`${path} reordered or dropped an enum value: values only append (5.5)`);
    }
}
/** Why a released entry's own facts and history may not become its successor's. */
function formProblem(path, old, next) {
    if (old['name'] !== next['name']) {
        return `${path} was renamed to ${String(next['name'])}: a released id keeps its name (5.5)`;
    }
    const changed = changedKeys(old, next);
    if (changed.length > NONE) {
        return `${path} changed ${changed.join(', ')}: a released id is retyped as a new id plus a deprecation (5.5)`;
    }
    if (JSON.stringify(old['since']) !== JSON.stringify(next['since'])) {
        return `${path} changed its since: history is fixed (5.5)`;
    }
    const [was, is] = [old['deprecated'], next['deprecated']];
    return was !== undefined && was !== is
        ? `${path} moved or dropped its deprecation: it may only be added (5.5)`
        : undefined;
}
/** A released node against its successor: both present and compared, or both absent. */
function compareNodes(
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a diff collects its problems
diff, path, pair) {
    const [mine, theirs] = pair;
    if ((mine === undefined) !== (theirs === undefined)) {
        diff.problems.push(`${path} gained or lost its node: a released id keeps its form (5.5)`);
    }
    else if (mine !== undefined && theirs !== undefined) {
        // oxlint-disable-next-line no-use-before-define -- nodes nest
        compareEntries(diff, `${path}.node`, [mine, theirs]);
    }
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
    compareValues(diff, path, pair);
    const [mine, theirs] = [childrenOf(old), childrenOf(next)];
    compareLists(diff, path, [mine.fields, theirs.fields]);
    compareNodes(diff, path, [mine.node, theirs.node]);
}
export { childrenOf, compareEntries, compareLists, entriesOf, isRecord, };
