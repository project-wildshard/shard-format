import { readFile } from 'node:fs/promises'

import { loadCandidate } from './corpus-candidate.ts'
import { corpusGate, readKnownFailures } from './corpus-gate.ts'
import { readPins } from './corpus-pins.ts'
import { corpusReport } from './corpus-report.ts'
import { corpusUsage, writeUsage } from './corpus-usage.ts'
import { runCorpus } from './corpus.ts'
import { readVersion } from './version.ts'

import type { CorpusRow } from './corpus.ts'

interface CorpusArgs {
  readonly api: string
  readonly cache: string
  readonly usage: string | undefined
  readonly pins: string | undefined
  readonly candidate: string | undefined
  readonly only: string | undefined
}

const EXIT_OK = 0
const EXIT_INVALID = 3
const NONE = 0
const KNOWN_FAILURES = 'corpus/known-failures.json'

/** Every kept original's row, with engine's pins when `--pins` names them (FE13). */
async function corpusRows(
  args: Readonly<CorpusArgs>,
): Promise<Readonly<{ rows: CorpusRow[]; validator: string }>> {
  const validator = await readVersion()
  const pins = args.pins === undefined ? [] : await readPins(args.pins)
  const candidate =
    args.candidate === undefined
      ? {}
      : { candidate: await loadCandidate(args.candidate) }
  const only = args.only === undefined ? {} : { only: args.only.split(',') }
  const rows = await runCorpus({
    api: args.api,
    cache: args.cache,
    validator,
    pins,
    ...candidate,
    ...only,
  })
  return { rows, validator }
}

/** `shard-format corpus`: every kept original, as stored (FE3), gated by FE5's known failures; `--usage` writes FE13's record. */
async function corpusCommand(args: Readonly<CorpusArgs>): Promise<number> {
  const { rows, validator } = await corpusRows(args)
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
