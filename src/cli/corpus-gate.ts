import {
  array,
  minLength,
  number,
  parse,
  pipe,
  regex,
  safeInteger,
  strictObject,
  string,
} from 'valibot'

import type { CorpusRow } from './corpus.ts'

// SHARD-COMPAT FE5 (meta, J486, Q51): the corpus gates a format release. A stored original that fails blocks the
// release unless `corpus/known-failures.json` lists it with the row that owns its repair; a listed one that passes
// again is named as stale, so the list only shrinks.

/** A stored original known to fail, and the row that owns its repair. */
interface KnownFailure {
  readonly hash: string
  readonly slug: string
  readonly revision: number
  readonly owner: string
}

/** What the gate decided: the failures that block, the stale entries, and one line for each. */
interface CorpusGate {
  readonly blocking: readonly CorpusRow[]
  readonly stale: readonly KnownFailure[]
  readonly lines: readonly string[]
}

const HASH = pipe(string(), regex(/^[a-f0-9]{64}$/u))
const REVISION = pipe(number(), safeInteger())
const NAMED = 1
const OWNER = pipe(string(), minLength(NAMED))
const KnownFailuresSchema = array(
  strictObject({
    hash: HASH,
    slug: string(),
    revision: REVISION,
    owner: OWNER,
  }),
)

/** Parse `corpus/known-failures.json`. */
function readKnownFailures(text: string): readonly KnownFailure[] {
  const input: unknown = JSON.parse(text)
  return parse(KnownFailuresSchema, input)
}

function named(found: Readonly<{ slug: string; revision: number }>): string {
  return `${found.slug} r${String(found.revision)}`
}

/** The failing rows, each with its owner when the list knows it. */
function failures(
  rows: readonly CorpusRow[],
  owners: ReadonlyMap<string, string>,
): readonly (readonly [CorpusRow, string | undefined])[] {
  return rows
    .filter((found: Readonly<CorpusRow>): boolean => found.verdict === 'fails')
    .map((found: CorpusRow): readonly [CorpusRow, string | undefined] => [
      found,
      owners.get(found.hash),
    ])
}

/** Split the corpus rows by the known failures. */
function corpusGate(
  rows: readonly CorpusRow[],
  known: readonly KnownFailure[],
): CorpusGate {
  const owners = new Map(
    known.map((entry: KnownFailure): readonly [string, string] => [
      entry.hash,
      entry.owner,
    ]),
  )
  const failing = failures(rows, owners)
  const valid = new Set(
    rows
      .filter(
        (found: Readonly<CorpusRow>): boolean => found.verdict === 'valid',
      )
      .map((found: Readonly<CorpusRow>): string => found.hash),
  )
  const blocking = failing
    .filter(([, owner]): boolean => owner === undefined)
    .map(([found]): CorpusRow => found)
  const stale = known.filter((entry: KnownFailure): boolean =>
    valid.has(entry.hash),
  )
  const lines = [
    ...failing
      .filter(([, owner]): boolean => owner !== undefined)
      .map(
        ([found, owner]): string =>
          `known failure ${named(found)} (${owner ?? ''})`,
      ),
    ...stale.map(
      (entry: KnownFailure): string =>
        `stale known failure ${named(entry)}: it passes now; drop it from corpus/known-failures.json`,
    ),
    ...blocking.map(
      (found: Readonly<CorpusRow>): string =>
        `BLOCKS THE RELEASE: ${named(found)} ${found.reason ?? ''}`,
    ),
  ]
  return { blocking, stale, lines }
}

export { type CorpusGate, type KnownFailure, corpusGate, readKnownFailures }
