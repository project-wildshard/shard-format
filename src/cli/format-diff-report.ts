import { KINDS } from './format-diff.ts'

import type { Change, ChangeKind } from './format-diff-data.ts'
import type { Report } from './format-diff.ts'

// SHARD-COMPAT FE2: format-diff's report as text, one change per line.

const NONE = 0
const SHORT_ID = 12
const KIND_WIDTH = 11

/** The report as text, one change per line. */
function formatDiffReport(report: Readonly<Report>): string {
  const counts = KINDS.map(
    (kind: ChangeKind): string =>
      `${String(report.changes.filter((found: Readonly<Change>): boolean => found.kind === kind).length)} ${kind}`,
  )
  const chain =
    report.chain === undefined
      ? 'chain id unchanged'
      : `chain id ${report.chain.before.slice(NONE, SHORT_ID)} -> ${report.chain.after.slice(NONE, SHORT_ID)}`
  const lines = report.changes.map(
    (found: Readonly<Change>): string =>
      `${found.kind.padEnd(KIND_WIDTH)} ${found.path}  ${found.what}${found.op === undefined ? '' : `  (op: ${found.op})`}`,
  )
  const head = `format-diff: ${String(report.changes.length)} changes (${counts.join(', ')}); ${chain}; worst ${report.worst}`
  return [head, ...lines].join('\n')
}

export { formatDiffReport }
