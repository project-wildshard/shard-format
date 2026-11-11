import { readFile, writeFile } from 'node:fs/promises'

import { wireLockText } from '../src/lock.ts'
import { checkBaseline } from './baseline.ts'
import { checkWire } from './check.ts'

const FIRST_CLI_ARGUMENT = 2
const ONE_ARGUMENT = 1
const BASELINE_ARGUMENTS = 2
const EXIT_USAGE = 1
const EXIT_OK = 0
const NONE = 0

async function runBaseline(): Promise<number> {
  await checkBaseline()
  process.stdout.write('wire check --baseline: frozen v0 lock verified\n')
  return EXIT_OK
}

// Run from lib/cli/, two levels below the package root.
const LOCK = new URL('../../wire.lock.json', import.meta.url)
const BASELINE = new URL('../../wire.v0.lock.json', import.meta.url)

async function runCheck(): Promise<number> {
  const [committed, baseline] = await Promise.all([
    readFile(LOCK, 'utf8'),
    readFile(BASELINE, 'utf8'),
  ])
  // The baseline is the frozen WS2 lock, verified by `check --baseline`.
  const parsed: unknown = JSON.parse(baseline)
  const result = checkWire(committed, parsed)
  for (const problem of result.problems) {
    process.stderr.write(`wire check: ${problem}\n`)
  }
  if (result.problems.length > NONE) {
    return EXIT_USAGE
  }
  process.stdout.write(
    `wire check: lock current; against the v0 baseline ${String(result.kept)} kept, ${String(result.added.length)} added (${result.added.join(', ')})\n`,
  )
  return EXIT_OK
}

async function runLock(): Promise<number> {
  await writeFile(LOCK, wireLockText())
  process.stdout.write('wire lock: wrote wire.lock.json\n')
  return EXIT_OK
}

async function runOne(command: string | undefined): Promise<number> {
  if (command === 'check') {
    return await runCheck()
  }
  if (command === 'lock') {
    return await runLock()
  }
  process.stderr.write(
    'Usage: wire check [--baseline] | wire lock | --version\n',
  )
  return EXIT_USAGE
}

async function run(): Promise<number> {
  const args = process.argv.slice(FIRST_CLI_ARGUMENT)
  const [command, option] = args
  if (
    command === 'check' &&
    option === '--baseline' &&
    args.length === BASELINE_ARGUMENTS
  ) {
    return await runBaseline()
  }
  if (args.length === ONE_ARGUMENT) {
    return await runOne(command)
  }
  process.stderr.write(
    'Usage: wire check [--baseline] | wire lock | --version\n',
  )
  return EXIT_USAGE
}

try {
  process.exitCode = await run()
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  )
  process.exitCode = EXIT_USAGE
}
