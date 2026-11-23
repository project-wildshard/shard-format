import { readFile } from 'node:fs/promises'

import { corpusGate, readKnownFailures } from './corpus-gate.ts'
import { corpusUsage, writeUsage } from './corpus-usage.ts'
import { corpusReport, runCorpus } from './corpus.ts'
import { readVersion } from './version.ts'

interface CorpusArgs {
  readonly api: string
  readonly cache: string
  readonly usage: string | undefined
}

const EXIT_OK = 0
const EXIT_INVALID = 3
const NONE = 0
const KNOWN_FAILURES = 'corpus/known-failures.json'

/** `shard-format corpus`: every kept original, as stored (FE3), gated by FE5's known failures; `--usage` writes FE13's record. */
async function corpusCommand(args: Readonly<CorpusArgs>): Promise<number> {
  const validator = await readVersion()
  const rows = await runCorpus({ api: args.api, cache: args.cache, validator })
  process.stdout.write(`${corpusReport(rows)}\n`)
  if (args.usage !== undefined) {
    await writeUsage(args.usage, corpusUsage(rows, validator, new Date()))
  }
  // SHARD-COMPAT FE5: only a failure not listed with its owner blocks a release.
  const listed = await readFile(KNOWN_FAILURES, 'utf8').catch(
    (): string => '[]',
  )
  const gate = corpusGate(rows, readKnownFailures(listed))
  if (gate.lines.length > NONE) {
    process.stdout.write(`${gate.lines.join('\n')}\n`)
  }
  return gate.blocking.length > NONE ? EXIT_INVALID : EXIT_OK
}

export { corpusCommand }
