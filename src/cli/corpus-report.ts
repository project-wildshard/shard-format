import { deprecationLines } from './corpus-deprecations.ts'

import type { CorpusRow } from './corpus.ts'

// `shard-format corpus`'s text report (FE3): one line per original, the
// totals, then FE7's deprecation users.

const NONE = 0
const FIRST = 0
const SHORT_HASH = 12
const VERDICT_WIDTH = 5

function corpusReport(rows: readonly CorpusRow[]): string {
  const lines = rows.map(
    (found: Readonly<CorpusRow>): string =>
      `${found.verdict.padEnd(VERDICT_WIDTH)} ${found.slug} r${String(found.revision)} ${found.hash.slice(FIRST, SHORT_HASH)}${found.reason === undefined ? '' : ` ${found.reason}`}`,
  )
  const failed = rows.filter(
    (found: Readonly<CorpusRow>): boolean => found.verdict === 'fails',
  ).length
  const fetched = rows.filter(
    (found: Readonly<CorpusRow>): boolean => !found.cached,
  )
  const bytes = fetched.reduce(
    (sum: number, found: Readonly<CorpusRow>): number =>
      sum + found.storedBytes,
    NONE,
  )
  lines.push(
    `corpus: ${String(rows.length)} kept originals, ${String(rows.length - failed)} valid, ${String(failed)} fail; fetched ${String(fetched.length)} (${String(bytes)} stored bytes), ${String(rows.length - fetched.length)} from cache`,
    ...deprecationLines(rows),
  )
  return lines.join('\n')
}

export { corpusReport }
