import { array, exactOptional, parse, strictObject, string } from 'valibot'

import { compareShardfileVersions } from '../format/version.ts'

import type { Change } from '../cli/format-diff-data.ts'
import type { Report } from '../cli/format-diff.ts'

// SHARD-COMPAT FE4 (Q15, Q49): the format gate. Every `breaking` or
// `review` change FE2 finds between the last release tag's lock and this
// tree's must be named in `src/format/breaks/<format version>.json`:
//   - `migration`: an FE8 chain step id that mends old files, or
//   - `deprecation`: an FE7 id, for what can't be migrated (counted, then
//     deleted at zero users by FE13), or
//   - `noFileChange`: why old files still read and mean the same (a code
//     export, a policy table judged only at upload).
// A migration or deprecation also needs the format version to rise above
// the tag's and a fixture folder `corpus/format-versions/<version>/`.
// Additive and deprecation changes pass as they are; FE5 holds the release
// on the corpus (FE3).

const MaybeText = exactOptional(string())
const BreakEntrySchema = strictObject({
  path: string(),
  migration: MaybeText,
  deprecation: MaybeText,
  noFileChange: MaybeText,
})
const BreakFileSchema = strictObject({
  version: string(),
  entries: array(BreakEntrySchema),
})

interface BreakEntry {
  readonly path: string
  readonly migration?: string
  readonly deprecation?: string
  readonly noFileChange?: string
}

interface BreakFile {
  readonly version: string
  readonly entries: readonly BreakEntry[]
}

interface GateInput {
  readonly base: string
  readonly baseVersion: string
  readonly version: string
  readonly report: Readonly<Report>
  readonly breaks: Readonly<BreakFile> | undefined
  readonly fixture: boolean
  readonly migrations: ReadonlySet<string>
  readonly deprecations: ReadonlySet<string>
}

interface GateResult {
  readonly ok: boolean
  readonly lines: readonly string[]
}

const NONE = 0

/** A break file's text, checked; its version must be the file's. */
function readBreakFile(text: string, version: string): BreakFile {
  const breaks = parse(BreakFileSchema, JSON.parse(text))
  if (breaks.version !== version) {
    throw new Error(
      `src/format/breaks/${version}.json names version ${breaks.version}`,
    )
  }
  return breaks
}

function needsEntry(change: Readonly<Change>): boolean {
  return change.kind === 'breaking' || change.kind === 'review'
}

/** What is wrong with one change's entry, or nothing. */
function entryProblem(
  change: Readonly<Change>,
  entry: Readonly<BreakEntry> | undefined,
  input: Readonly<GateInput>,
): string | undefined {
  const file = `src/format/breaks/${input.version}.json`
  if (entry === undefined) {
    return `${change.path}: ${change.kind} (${change.what}) needs an entry in ${file}: a migration id, a deprecation id, or noFileChange with the reason`
  }
  if (entry.migration !== undefined && !input.migrations.has(entry.migration)) {
    return `${change.path}: migration ${entry.migration} is not in FORMAT_MIGRATIONS`
  }
  if (
    entry.deprecation !== undefined &&
    !input.deprecations.has(entry.deprecation)
  ) {
    return `${change.path}: deprecation ${entry.deprecation} is not in DEPRECATIONS`
  }
  const named = [entry.migration, entry.deprecation, entry.noFileChange]
  return named.some((value: string | undefined): boolean => value !== undefined)
    ? undefined
    : `${change.path}: its entry names no migration, deprecation or noFileChange`
}

/** A migration or deprecation changes what files carry: the version rises and a fixture exists. */
function versionProblems(
  entries: readonly BreakEntry[],
  input: Readonly<GateInput>,
): readonly string[] {
  const moves = entries.some(
    (entry: Readonly<BreakEntry>): boolean =>
      entry.migration !== undefined || entry.deprecation !== undefined,
  )
  if (!moves) {
    return []
  }
  const problems: string[] = []
  if (compareShardfileVersions(input.version, input.baseVersion) <= NONE) {
    problems.push(
      `the format version must rise above ${input.base}'s ${input.baseVersion} (it is ${input.version})`,
    )
  }
  if (!input.fixture) {
    problems.push(
      `corpus/format-versions/${input.version}/ needs a fixture (CP1's test:chain reads it)`,
    )
  }
  return problems
}

function entryFor(
  change: Readonly<Change>,
  entries: readonly BreakEntry[],
): BreakEntry | undefined {
  return entries.find(
    (entry: Readonly<BreakEntry>): boolean => entry.path === change.path,
  )
}

function defined<Value>(value: Value | undefined): value is Value {
  return value !== undefined
}

/** The gate's verdict on one tree against its last release tag. */
function formatGate(input: Readonly<GateInput>): GateResult {
  const needed = input.report.changes.filter(
    (change: Readonly<Change>): boolean => needsEntry(change),
  )
  const entries = input.breaks?.entries ?? []
  const found = needed.map(
    (change: Readonly<Change>): readonly [Change, BreakEntry | undefined] => [
      change,
      entryFor(change, entries),
    ],
  )
  const used = found
    .map(
      ([, entry]: readonly [Change, BreakEntry | undefined]):
        | BreakEntry
        | undefined => entry,
    )
    .filter((entry: BreakEntry | undefined): entry is BreakEntry =>
      defined(entry),
    )
  const problems = [
    ...found
      .map(
        ([change, entry]: readonly [Change, BreakEntry | undefined]):
          | string
          | undefined => entryProblem(change, entry, input),
      )
      .filter((line: string | undefined): line is string => defined(line)),
    ...versionProblems(used, input),
  ]
  const counts = `${String(input.report.changes.length)} changes, ${String(needed.length)} breaking or review, ${String(used.length)} named in src/format/breaks/${input.version}.json`
  return {
    ok: problems.length === NONE,
    lines: [`format gate against ${input.base}: ${counts}`, ...problems],
  }
}

export { formatGate, readBreakFile }
export type { BreakFile, GateInput, GateResult }
