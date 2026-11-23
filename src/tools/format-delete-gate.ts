import { CHAIN, DEPRECATIONS } from '../cli/format-diff-paths.ts'

import type { Usage } from '../cli/corpus-usage.ts'
import type { Change } from '../cli/format-diff-data.ts'

// SHARD-COMPAT FE13: the delete gate, inside FE4's format gate. Deleting a
// deprecated part (its FE7 row) or a chain step (its FE8 row) needs
// `corpus/usage.json` (`pnpm corpus:usage`) from the last 24 hours showing
// no kept original uses it; otherwise the gate names the users.

const DAY_MS = 86_400_000
const NONE = 0

/** Whether a change deletes a deprecated part or a chain step. */
function isDeletion(change: Readonly<Change>): boolean {
  return (
    change.kind === 'breaking' &&
    (change.path.startsWith(DEPRECATIONS) || change.path.startsWith(CHAIN))
  )
}

function usersOf(
  change: Readonly<Change>,
  usage: Readonly<Usage>,
): readonly string[] {
  if (change.path.startsWith(CHAIN)) {
    return usage.migrations[change.path.slice(CHAIN.length)] ?? []
  }
  return usage.deprecations[change.path.slice(DEPRECATIONS.length)] ?? []
}

/** What stops one deletion, or nothing. */
function deletionProblem(
  change: Readonly<Change>,
  usage: Readonly<Usage> | undefined,
  now: number,
): string | undefined {
  if (usage === undefined) {
    return `${change.path}: deleting it needs corpus/usage.json (pnpm corpus:usage) showing no kept original uses it`
  }
  if (usage.pins === undefined) {
    return `${change.path}: corpus/usage.json covers no engine shard pins: run pnpm corpus:usage (it reads them with --pins)`
  }
  if (now - Date.parse(usage.measuredAt) > DAY_MS) {
    return `${change.path}: corpus/usage.json is from ${usage.measuredAt}, over 24 hours old: run pnpm corpus:usage`
  }
  const users = usersOf(change, usage)
  return users.length === NONE
    ? undefined
    : `${change.path}: ${String(users.length)} kept originals still use it (${users.join(', ')})`
}

export { deletionProblem, isDeletion }
