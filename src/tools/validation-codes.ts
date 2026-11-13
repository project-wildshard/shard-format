import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'

import { issueCodeRows } from '../format/issue-codes.ts'

import type { IssueCodeRow, IssueFamily } from '../format/issue-codes.ts'

// SHARD-AUTHORING SA41: docs/VALIDATION-CODES.md is generated whole from src/format/issue-codes.ts.
// `node src/tools/validation-codes.ts write` rewrites it; validation-codes.test.ts fails when it drifts.

const ROOT = new URL('../../', import.meta.url)
const CODES_PATH = 'docs/VALIDATION-CODES.md'
const COMMAND_ARG = 2
const EXIT_USAGE = 2

const FAMILIES: readonly (readonly [IssueFamily, string])[] = [
  [
    'validate',
    '`validateShardfileProduct`, `validateShardfileStream` and `readTar`: `error.code` on the thrown Error.',
  ],
  [
    'stream',
    '`validateShardfileStream` alone: `error.code` on the thrown Error.',
  ],
  [
    'performance',
    '`performanceReport` and `performanceTargetIssues`: `PerformanceIssue.code`.',
  ],
  [
    'audio',
    '`audioReport`: `AudioFinding.code`; `assertAudioAdmission`: `error.code` on the thrown Error.',
  ],
]

const HEAD = `# Validation codes

> Written by: Claude

> **State:** generated from \`src/format/issue-codes.ts\` (SHARD-AUTHORING SA41). Do not edit by hand: run
> \`node src/tools/validation-codes.ts write\`.

Every issue shard-format reports carries a stable \`code\`: a validator refusal, a performance report issue and an audio
finding. Match the code, never the message: messages may be reworded, codes are renamed only with a release note.

- A validator tags a refusal by the check that refused; a code set nearer the throw wins. Both validators give the same
  code for the same refusal.
- A code that is not in these tables (Node's \`ENOENT\` from a file port, \`ERR_ENCODING_INVALID_ENCODED_DATA\` from
  bad UTF-8) is replaced by the check's code; such codes differ by host. The message keeps its words.
- \`issueCodeOf(error)\` (\`@wildshard/shard-format/issue-codes\`) returns a refusal's code, or \`undefined\`.
`

/** One family's table. */
function familyTable(family: IssueFamily, where: string): string {
  const rows = issueCodeRows()
    .filter((row: IssueCodeRow): boolean => row.family === family)
    .map((row: IssueCodeRow): string => `| \`${row.code}\` | ${row.meaning} |`)
  return [
    `## ${family}`,
    '',
    where,
    '',
    '| Code | Meaning |',
    '|---|---|',
    ...rows,
  ].join('\n')
}

/** The whole page, from the table. */
function renderCodes(): string {
  const tables = FAMILIES.map(
    ([family, where]: readonly [IssueFamily, string]): string =>
      familyTable(family, where),
  )
  return `${[HEAD, ...tables].join('\n')}\n`
}

/** The page as committed. */
async function readCodes(): Promise<string> {
  return await readFile(new URL(CODES_PATH, ROOT), 'utf8')
}

if (import.meta.main) {
  if (process.argv[COMMAND_ARG] === 'write') {
    const next = renderCodes()
    const page = await readCodes().catch((): string => '')
    await writeFile(new URL(CODES_PATH, ROOT), next)
    const said = page === next ? 'unchanged' : 'rewritten'
    process.stdout.write(`${CODES_PATH} ${said}\n`)
  } else {
    process.stderr.write('usage: node src/tools/validation-codes.ts write\n')
    process.exitCode = EXIT_USAGE
  }
}

export { CODES_PATH, FAMILIES, readCodes, renderCodes }
