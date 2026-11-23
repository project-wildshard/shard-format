import type { CorpusRow } from '../cli/corpus.ts'
import type { Deprecation } from '../format/deprecations.ts'

// SHARD-COMPAT CP17 (J486, Q31): what the re-upload tool does for one
// deprecated part, shard by shard. A shard counts when its newest kept
// revision still uses the part (older revisions leave the corpus with
// CP12's prune). A chain step that mends it means the API migrates the
// shard; a first-party shard (its repo in `corpus/first-party.json`) is
// re-published from that repo's `publish.yml`; any other shard gets a
// needs-author note naming the replacement.

type Action = 'migrate' | 'republish' | 'needs-author'

interface ReuploadStep {
  readonly slug: string
  readonly revision: number
  readonly action: Action
  /** The first-party repo that re-publishes it. */
  readonly repo: string | undefined
  readonly detail: string
}

/** Who uses a deprecated part: every kept original, and each shard's newest. */
interface Users {
  readonly kept: readonly string[]
  readonly heads: readonly string[]
}

const nameOf = (row: Readonly<CorpusRow>): string =>
  `${row.slug} r${String(row.revision)}`

/** Each shard's newest kept revision. */
function headsOf(
  rows: readonly Readonly<CorpusRow>[],
): ReadonlyMap<string, Readonly<CorpusRow>> {
  const heads = new Map<string, Readonly<CorpusRow>>()
  for (const row of rows) {
    const held = heads.get(row.slug)
    if (held === undefined || row.revision > held.revision) {
      heads.set(row.slug, row)
    }
  }
  return heads
}

/** The kept originals, and the shards' newest revisions, that use `id`. */
function usersOf(rows: readonly Readonly<CorpusRow>[], id: string): Users {
  const uses = (row: Readonly<CorpusRow>): boolean =>
    row.deprecations.includes(id)
  return {
    kept: rows
      .filter((row: Readonly<CorpusRow>): boolean => uses(row))
      .map((row: Readonly<CorpusRow>): string => nameOf(row)),
    heads: [...headsOf(rows).values()]
      .filter((row: Readonly<CorpusRow>): boolean => uses(row))
      .map((row: Readonly<CorpusRow>): string => nameOf(row)),
  }
}

function stepOf(
  head: Readonly<CorpusRow>,
  deprecation: Readonly<Deprecation>,
  repos: Readonly<Record<string, string>>,
): ReuploadStep {
  const base = { slug: head.slug, revision: head.revision }
  if (deprecation.migration !== undefined) {
    return {
      ...base,
      action: 'migrate',
      repo: undefined,
      detail: `the API migrates it (chain step ${deprecation.migration})`,
    }
  }
  const repo = repos[head.slug]
  return repo === undefined
    ? {
        ...base,
        action: 'needs-author',
        repo,
        detail: `needs its author: ${deprecation.replacement}`,
      }
    : {
        ...base,
        action: 'republish',
        repo,
        detail: `re-publish from ${repo} (publish.yml)`,
      }
}

/** One step per shard whose newest revision uses the deprecated part. */
function reuploadPlan(
  rows: readonly Readonly<CorpusRow>[],
  deprecation: Readonly<Deprecation>,
  repos: Readonly<Record<string, string>>,
): readonly ReuploadStep[] {
  return [...headsOf(rows).values()]
    .filter((head: Readonly<CorpusRow>): boolean =>
      head.deprecations.includes(deprecation.id),
    )
    .map((head: Readonly<CorpusRow>): ReuploadStep =>
      stepOf(head, deprecation, repos),
    )
}

export { headsOf, reuploadPlan, usersOf }
export type { Action, ReuploadStep, Users }
