import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { wireLockText } from '../src/lock.ts'
import { checkBaseline } from './baseline.ts'
import { checkWire } from './check.ts'
import { checkRelease } from './release-ref.ts'

const FIRST_CLI_ARGUMENT = 2
const ONE_ARGUMENT = 1
const BASELINE_ARGUMENTS = 2
const AGAINST_ARGUMENTS = 3
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
const ROOT = fileURLToPath(new URL('../..', import.meta.url))

/** Say every problem; true when there were none. */
function report(problems: readonly string[]): boolean {
  for (const problem of problems) {
    process.stderr.write(`wire check: ${problem}\n`)
  }
  return problems.length === NONE
}

async function runCheck(against?: string): Promise<number> {
  const [committed, baseline] = await Promise.all([
    readFile(LOCK, 'utf8'),
    readFile(BASELINE, 'utf8'),
  ])
  // The baseline is the frozen WS2 lock, verified by `check --baseline`.
  const result = checkWire(committed, JSON.parse(baseline))
  const release = await checkRelease(ROOT, committed, against)
  if (!report([...result.problems, ...release.problems])) {
    return EXIT_USAGE
  }
  const held =
    release.against === undefined
      ? 'no wire release to hold the lock to yet'
      : `release rules hold against ${release.against}`
  process.stdout.write(
    `wire check: ${held}\nwire check: lock current; against the v0 baseline ${String(result.kept)} kept, ${String(result.added.length)} added (${result.added.join(', ')})\n`,
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
    'Usage: wire check [--baseline | --against <ref>] | wire lock | --version\n',
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
  if (
    command === 'check' &&
    option === '--against' &&
    args.length === AGAINST_ARGUMENTS
  ) {
    return await runCheck(args.at(-ONE_ARGUMENT))
  }
  if (args.length === ONE_ARGUMENT) {
    return await runOne(command)
  }
  process.stderr.write(
    'Usage: wire check [--baseline | --against <ref>] | wire lock | --version\n',
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
