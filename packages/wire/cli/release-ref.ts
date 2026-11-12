import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { realpath } from 'node:fs/promises'
import path from 'node:path'
import { text as readAll } from 'node:stream/consumers'

import {
  isReleaseLock,
  patchProblems,
  releaseProblems,
  reuseProblems,
} from './release.ts'

import type { ReleaseClock, ReleaseLock } from './release.ts'

// Where `wire check` finds the released locks: `--against <ref>` (a scratch
// ref until `wire-v1.0.0` exists, WR6), else the newest `wire-vM.m.0` tag
// reachable from HEAD; every earlier reachable release is checked for reuse.
// Tag dates give the 14-day window; HEAD's commit date is "now", so a check
// reads the same tomorrow. No release yet, or a copy installed outside the
// shardfile checkout, means the rules have nothing to hold the lock to.

const LOCK_PATH = 'packages/wire/wire.lock.json'
const MINOR_TAGS = 'wire-v*.*.0'
const NONE = 0
const OK = 0

/** Run git in `cwd`; its stdout, trimmed. A failing git throws. */
async function git(cwd: string, args: readonly string[]): Promise<string> {
  const child = spawn('git', args, { cwd, stdio: ['ignore', 'pipe', 'ignore'] })
  const [stdout, closed] = await Promise.all([
    readAll(child.stdout),
    once(child, 'close'),
  ])
  const code: unknown = closed.at(NONE)
  if (code !== OK) {
    throw new Error(`git ${args.join(' ')} failed`)
  }
  return stdout.trim()
}

/** Git's answer, or undefined when it has none (no such tag). */
async function maybe(
  cwd: string,
  args: readonly string[],
): Promise<string | undefined> {
  try {
    return await git(cwd, args)
  } catch {
    return undefined
  }
}

const lines = (text: string | undefined): readonly string[] =>
  (text ?? '').split('\n').filter((line: string): boolean => line !== '')

/** True when `root` is this package inside the shardfile repo's own checkout, where releases are tagged. */
async function inSourceRepo(root: string): Promise<boolean> {
  const top = await maybe(root, ['rev-parse', '--show-toplevel'])
  if (top === undefined) {
    return false
  }
  // An installed copy inside another git repo (a consumer's node_modules)
  // finds that repo's top, which has no packages/wire: not the source.
  const own = await realpath(path.join(top, 'packages', 'wire')).catch(
    (): undefined => undefined,
  )
  return own !== undefined && own === (await realpath(root))
}

/** A lock as a release lock, or a refusal. */
async function lockAt(cwd: string, ref: string): Promise<ReleaseLock> {
  const value: unknown = JSON.parse(
    await git(cwd, ['show', `${ref}:${LOCK_PATH}`]),
  )
  if (!isReleaseLock(value)) {
    throw new Error(`${ref} holds no wire lock`)
  }
  return value
}

/** Tag dates for the 14-day window: when `wire-v<major>.<minor>.0` was made. */
async function clockFor(cwd: string, major: number): Promise<ReleaseClock> {
  const listed = await git(cwd, [
    'for-each-ref',
    '--format=%(refname:short) %(creatordate:unix)',
    'refs/tags',
  ])
  const dates = new Map(
    lines(listed).map((line: string): readonly [string, number] => {
      const [tag = '', date = ''] = line.split(' ')
      return [tag, Number(date)]
    }),
  )
  const now = Number(await git(cwd, ['log', '-1', '--format=%ct', 'HEAD']))
  return {
    now,
    releasedAt: (minor: number): number | undefined =>
      dates.get(`wire-v${String(major)}.${String(minor)}.0`),
  }
}

/** The patch-tag rule for every patch tag on HEAD, against that tag's own minor. */
async function patchTags(
  cwd: string,
  current: string,
): Promise<readonly string[]> {
  const tags = lines(await git(cwd, ['tag', '--points-at', 'HEAD']))
  const found = await Promise.all(
    tags.map(async (tag: string): Promise<readonly string[]> => {
      const minor = /^(?<minor>wire-v\d+\.\d+)\.\d+$/u.exec(tag)?.groups?.[
        'minor'
      ]
      const released =
        minor === undefined
          ? undefined
          : await maybe(cwd, ['show', `${minor}.0:${LOCK_PATH}`])
      return released === undefined
        ? []
        : patchProblems(tag, `${released}\n`, current)
    }),
  )
  return found.flat()
}

/** What the release rules say: the ref compared, and its problems. */
interface ReleaseResult {
  readonly against: string | undefined
  readonly problems: readonly string[]
}

/** Reuse against every release before the last. */
async function earlierProblems(
  cwd: string,
  last: string,
  next: ReleaseLock,
): Promise<readonly string[]> {
  const earlier = lines(
    await maybe(cwd, ['tag', '--merged', 'HEAD', '--list', MINOR_TAGS]),
  ).filter((tag: string): boolean => tag !== last)
  const locks = await Promise.all(
    earlier.map(
      async (tag: string): Promise<ReleaseLock> => await lockAt(cwd, tag),
    ),
  )
  return locks.flatMap((lock: ReleaseLock, at: number): readonly string[] =>
    reuseProblems(lock, next).map(
      (problem: string): string => `${earlier[at] ?? ''}: ${problem}`,
    ),
  )
}

/** The release rules for the lock at `current`, against `against` or the last reachable release. */
async function checkRelease(
  cwd: string,
  current: string,
  against: string | undefined,
): Promise<ReleaseResult> {
  if (!(await inSourceRepo(cwd))) {
    return { against: undefined, problems: [] }
  }
  const ref =
    against ??
    (await maybe(cwd, [
      'describe',
      '--tags',
      '--abbrev=0',
      '--match',
      MINOR_TAGS,
      'HEAD',
    ]))
  if (ref === undefined) {
    return { against: undefined, problems: [] }
  }
  const [old, parsed] = [await lockAt(cwd, ref), JSON.parse(current) as unknown]
  if (!isReleaseLock(parsed)) {
    throw new Error('wire.lock.json is not a wire lock')
  }
  return {
    against: ref,
    problems: [
      ...releaseProblems(old, parsed, await clockFor(cwd, old.wireMajor)),
      ...(await earlierProblems(cwd, ref, parsed)),
      ...(await patchTags(cwd, current)),
    ],
  }
}

export { checkRelease, type ReleaseResult }
