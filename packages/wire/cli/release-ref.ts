import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { realpath } from 'node:fs/promises'
import path from 'node:path'
import { text as readAll } from 'node:stream/consumers'

import { isReleaseLock, patchProblems, releaseProblems } from './release.ts'

import type { ReleaseLock } from './release.ts'

// Where `wire check` finds the released lock: `--against <ref>` (a scratch
// tag until `wire-v1.0.0` exists, WR6), else the newest `wire-vM.m.0` tag.
// No release yet, or a copy installed outside the shardfile checkout, means
// the rules have nothing to hold the lock to.

const LOCK_PATH = 'packages/wire/wire.lock.json'
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

/** The newest minor release tag, if any. */
async function lastRelease(cwd: string): Promise<string | undefined> {
  const tags = await git(cwd, [
    'tag',
    '--list',
    'wire-v*.*.0',
    '--sort=-v:refname',
  ])
  return tags.split('\n').find((tag: string): boolean => tag !== '')
}

/** True when `root` is this package inside the shardfile repo's own checkout, where releases are tagged. */
async function inSourceRepo(root: string): Promise<boolean> {
  try {
    const top = await git(root, ['rev-parse', '--show-toplevel'])
    const [own, here] = await Promise.all([
      realpath(path.join(top, 'packages', 'wire')),
      realpath(root),
    ])
    return own === here
  } catch {
    return false
  }
}

/** A lock text as a release lock, or a refusal. */
function lockOf(text: string, what: string): ReleaseLock {
  const value: unknown = JSON.parse(text)
  if (!isReleaseLock(value)) {
    throw new Error(`${what} is not a wire lock`)
  }
  return value
}

/** What the release rules say: the ref compared, and its problems. */
interface ReleaseResult {
  readonly against: string | undefined
  readonly problems: readonly string[]
}

/** The patch-tag rule for every tag on HEAD. */
async function patchTags(
  cwd: string,
  released: string,
  current: string,
): Promise<readonly string[]> {
  const listed = await git(cwd, ['tag', '--points-at', 'HEAD'])
  return listed
    .split('\n')
    .filter((tag: string): boolean => tag.length > NONE)
    .flatMap((tag: string): readonly string[] =>
      patchProblems(tag, `${released}\n`, current),
    )
}

/** The release rules for the lock at `current`, against `against` or the last release. */
async function checkRelease(
  cwd: string,
  current: string,
  against: string | undefined,
): Promise<ReleaseResult> {
  const ref = (await inSourceRepo(cwd))
    ? (against ?? (await lastRelease(cwd)))
    : undefined
  if (ref === undefined) {
    return { against: undefined, problems: [] }
  }
  const released = await git(cwd, ['show', `${ref}:${LOCK_PATH}`])
  return {
    against: ref,
    problems: [
      ...releaseProblems(
        lockOf(released, ref),
        lockOf(current, 'wire.lock.json'),
      ),
      ...(await patchTags(cwd, released, current)),
    ],
  }
}

export { checkRelease, type ReleaseResult }
