import {
  array,
  integer,
  minValue,
  number,
  object,
  optional,
  parse,
  pipe,
  record,
  string,
} from 'valibot'

// The shrink-only ratchet over src/format, the code imported from
// singleplayer (D28, D29). The baseline records, per file, how many
// times each lint rule fires, and which files oxfmt would change. A
// count may fall, never rise; a file outside the baseline must be clean.

/** How often each rule fires in one file. */
type RuleCounts = Readonly<Record<string, number>>

/** Lint counts by file, then by rule. */
type LintCounts = Readonly<Record<string, RuleCounts>>

interface Baseline {
  readonly lint: LintCounts
  readonly unformatted: readonly string[]
}

interface Comparison {
  /** Counts above the baseline: the check fails. */
  readonly rises: readonly string[]
  /** Counts below the baseline: lock them in with `update`. */
  readonly drops: readonly string[]
}

type Row = readonly [label: string, was: number, now: number]

// Unused-directive reports carry no rule code.
const UNUSED_DIRECTIVE = 'unused-disable-directive'
const NONE = 0
const ONE = 1
const INDENT = 1
const EMPTY: RuleCounts = {}

const Diagnostic = object({ filename: string(), code: optional(string()) })
const DiagnosticsSchema = object({ diagnostics: array(Diagnostic) })
const Count = pipe(number(), integer(), minValue(ONE))
const RuleCountsSchema = record(string(), Count)
const BaselineSchema = object({
  lint: record(string(), RuleCountsSchema),
  unformatted: array(string()),
})

function byKey(
  [left]: readonly [string, unknown],
  [right]: readonly [string, unknown],
): number {
  return left.localeCompare(right)
}

function sortedRules(
  entries: readonly (readonly [string, number])[],
): RuleCounts {
  const sorted = entries.toSorted(byKey)
  return Object.fromEntries(sorted)
}

function sortedFiles(
  entries: readonly (readonly [string, RuleCounts])[],
): LintCounts {
  const sorted = entries.toSorted(byKey)
  const rows = sorted.map(
    ([file, rules]: readonly [string, RuleCounts]): readonly [
      string,
      RuleCounts,
    ] => {
      const ruleEntries = Object.entries(rules)
      return [file, sortedRules(ruleEntries)]
    },
  )
  return Object.fromEntries(rows)
}

/** Counts oxlint's `-f json` output by file and rule. */
function countLint(json: unknown): LintCounts {
  const counts = new Map<string, Map<string, number>>()
  const { diagnostics } = parse(DiagnosticsSchema, json)
  for (const { filename, code } of diagnostics) {
    const rules = counts.get(filename) ?? new Map<string, number>()
    const rule = code ?? UNUSED_DIRECTIVE
    rules.set(rule, (rules.get(rule) ?? NONE) + ONE)
    counts.set(filename, rules)
  }
  const files = [...counts].map(
    ([file, rules]: readonly [string, ReadonlyMap<string, number>]): readonly [
      string,
      RuleCounts,
    ] => [file, Object.fromEntries(rules)],
  )
  return sortedFiles(files)
}

function describeRow([label, was, now]: Row): string {
  return `${label} ${String(was)} -> ${String(now)}`
}

function rose([, was, now]: Row): boolean {
  return now > was
}

function fell([, was, now]: Row): boolean {
  return now < was
}

function union(left: readonly string[], right: readonly string[]): string[] {
  const all = new Set([...left, ...right])
  return [...all].toSorted()
}

function fileChanges(
  file: string,
  before: RuleCounts,
  after: RuleCounts,
): Comparison {
  const rules = union(Object.keys(before), Object.keys(after))
  const rows = rules.map((rule: string): Row => [
    `${file}: ${rule}`,
    before[rule] ?? NONE,
    after[rule] ?? NONE,
  ])
  const rises = rows.filter((row: Row): boolean => rose(row))
  const drops = rows.filter((row: Row): boolean => fell(row))
  return {
    rises: rises.map((row: Row): string => describeRow(row)),
    drops: drops.map((row: Row): string => describeRow(row)),
  }
}

function lintChanges(baseline: LintCounts, current: LintCounts): Comparison {
  const files = union(Object.keys(baseline), Object.keys(current))
  const changes = files.map((file: string): Comparison =>
    fileChanges(file, baseline[file] ?? EMPTY, current[file] ?? EMPTY),
  )
  return {
    rises: changes.flatMap(
      (change: Comparison): readonly string[] => change.rises,
    ),
    drops: changes.flatMap(
      (change: Comparison): readonly string[] => change.drops,
    ),
  }
}

function missing(
  files: readonly string[],
  others: readonly string[],
  note: string,
): string[] {
  const known = new Set(others)
  const absent = files.filter((file: string): boolean => !known.has(file))
  return absent.map((file: string): string => `${file}: ${note}`)
}

/** Compares the current state against the baseline. */
function compareBaseline(baseline: Baseline, current: Baseline): Comparison {
  const lint = lintChanges(baseline.lint, current.lint)
  return {
    rises: [
      ...lint.rises,
      ...missing(
        current.unformatted,
        baseline.unformatted,
        'newly unformatted',
      ),
    ],
    drops: [
      ...lint.drops,
      ...missing(baseline.unformatted, current.unformatted, 'now formatted'),
    ],
  }
}

/** The baseline file's text: stable order, one trailing newline. */
function baselineText(baseline: Baseline): string {
  const files = Object.entries(baseline.lint)
  const sorted = {
    lint: sortedFiles(files),
    unformatted: baseline.unformatted.toSorted(),
  }
  return `${JSON.stringify(sorted, undefined, INDENT)}\n`
}

export type { Baseline, Comparison, LintCounts }
export { BaselineSchema, baselineText, compareBaseline, countLint }
