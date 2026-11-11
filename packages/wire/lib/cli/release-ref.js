import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { text as readAll } from 'node:stream/consumers';
import { isReleaseLock, patchProblems, releaseProblems, reuseProblems, } from './release.js';
// Where `wire check` finds the released locks: `--against <ref>` (a scratch
// ref until `wire-v1.0.0` exists, WR6), else the newest `wire-vM.m.0` tag
// reachable from HEAD; every earlier reachable release is checked for reuse.
// Tag dates give the 14-day window; HEAD's commit date is "now", so a check
// reads the same tomorrow. No release yet, or a copy installed outside the
// shardfile checkout, means the rules have nothing to hold the lock to.
const LOCK_PATH = 'packages/wire/wire.lock.json';
const MINOR_TAGS = 'wire-v*.*.0';
const NONE = 0;
const OK = 0;
/** Run git in `cwd`; its stdout, trimmed. A failing git throws. */
async function git(cwd, args) {
    const child = spawn('git', args, { cwd, stdio: ['ignore', 'pipe', 'ignore'] });
    const [stdout, closed] = await Promise.all([
        readAll(child.stdout),
        once(child, 'close'),
    ]);
    const code = closed.at(NONE);
    if (code !== OK) {
        throw new Error(`git ${args.join(' ')} failed`);
    }
    return stdout.trim();
}
/** Git's answer, or undefined when it has none (no such tag). */
async function maybe(cwd, args) {
    try {
        return await git(cwd, args);
    }
    catch {
        return undefined;
    }
}
const lines = (text) => (text ?? '').split('\n').filter((line) => line !== '');
/** True when `root` is this package inside the shardfile repo's own checkout, where releases are tagged. */
async function inSourceRepo(root) {
    const top = await maybe(root, ['rev-parse', '--show-toplevel']);
    if (top === undefined) {
        return false;
    }
    const [own, here] = await Promise.all([
        realpath(path.join(top, 'packages', 'wire')),
        realpath(root),
    ]);
    return own === here;
}
/** A lock as a release lock, or a refusal. */
async function lockAt(cwd, ref) {
    const value = JSON.parse(await git(cwd, ['show', `${ref}:${LOCK_PATH}`]));
    if (!isReleaseLock(value)) {
        throw new Error(`${ref} holds no wire lock`);
    }
    return value;
}
/** Tag dates for the 14-day window: when `wire-v<major>.<minor>.0` was made. */
async function clockFor(cwd, major) {
    const listed = await git(cwd, [
        'for-each-ref',
        '--format=%(refname:short) %(creatordate:unix)',
        'refs/tags',
    ]);
    const dates = new Map(lines(listed).map((line) => {
        const [tag = '', date = ''] = line.split(' ');
        return [tag, Number(date)];
    }));
    const now = Number(await git(cwd, ['log', '-1', '--format=%ct', 'HEAD']));
    return {
        now,
        releasedAt: (minor) => dates.get(`wire-v${String(major)}.${String(minor)}.0`),
    };
}
/** The patch-tag rule for every patch tag on HEAD, against that tag's own minor. */
async function patchTags(cwd, current) {
    const tags = lines(await git(cwd, ['tag', '--points-at', 'HEAD']));
    const found = await Promise.all(tags.map(async (tag) => {
        const minor = /^(?<minor>wire-v\d+\.\d+)\.\d+$/u.exec(tag)?.groups?.['minor'];
        const released = minor === undefined
            ? undefined
            : await maybe(cwd, ['show', `${minor}.0:${LOCK_PATH}`]);
        return released === undefined
            ? []
            : patchProblems(tag, `${released}\n`, current);
    }));
    return found.flat();
}
/** Reuse against every release before the last. */
async function earlierProblems(cwd, last, next) {
    const earlier = lines(await maybe(cwd, ['tag', '--merged', 'HEAD', '--list', MINOR_TAGS])).filter((tag) => tag !== last);
    const locks = await Promise.all(earlier.map(async (tag) => await lockAt(cwd, tag)));
    return locks.flatMap((lock, at) => reuseProblems(lock, next).map((problem) => `${earlier[at] ?? ''}: ${problem}`));
}
/** The release rules for the lock at `current`, against `against` or the last reachable release. */
async function checkRelease(cwd, current, against) {
    if (!(await inSourceRepo(cwd))) {
        return { against: undefined, problems: [] };
    }
    const ref = against ??
        (await maybe(cwd, [
            'describe',
            '--tags',
            '--abbrev=0',
            '--match',
            MINOR_TAGS,
            'HEAD',
        ]));
    if (ref === undefined) {
        return { against: undefined, problems: [] };
    }
    const [old, parsed] = [await lockAt(cwd, ref), JSON.parse(current)];
    if (!isReleaseLock(parsed)) {
        throw new Error('wire.lock.json is not a wire lock');
    }
    return {
        against: ref,
        problems: [
            ...releaseProblems(old, parsed, await clockFor(cwd, old.wireMajor)),
            ...(await earlierProblems(cwd, ref, parsed)),
            ...(await patchTags(cwd, current)),
        ],
    };
}
export { checkRelease };
