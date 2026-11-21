#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'

import { corpusGate, readKnownFailures } from './corpus-gate.ts'
import { corpusReport, runCorpus } from './corpus.ts'
import { packFolder } from './pack.ts'
import { summary, validateShardfile } from './validate.ts'
import { readVersion } from './version.ts'

const EXIT_OK = 0
const EXIT_USAGE = 1
const EXIT_CRASH = 2
const EXIT_INVALID = 3
const NONE = 0

// Arguments start after [node, script] in process.argv.
const FIRST_CLI_ARG = 2
const DEFAULT_API = 'https://api.wildshard.io'
const DEFAULT_CACHE = 'tmp/corpus'
const KNOWN_FAILURES = 'corpus/known-failures.json'

const USAGE = `Usage: shard-format <command> [options]

Commands:
  validate <dir|tar>   Validate a built shardfile product, a folder or a
                       tarball (format checks only: schema, inventory,
                       hashes, budgets)
  pack <dir> [--out <file>]
                       Tar a folder into a shardfile: what its sections
                       measure follows them, and format's validator must
                       pass. Writes <slug>.tar by default
  corpus [--api <url>] [--cache <dir>]
                       Validate every stored shard file the API keeps,
                       as stored originals; list every failure. Exits 3
                       when any fails

Options:
  --version            Print the version
  --help               Print this help
`

interface CliArgs {
  readonly command: string | undefined
  readonly operands: readonly string[]
  readonly help: boolean
  readonly out: string | undefined
  readonly api: string
  readonly cache: string
  readonly version: boolean
}

function parseCliArgs(argv: readonly string[]): CliArgs {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      help: { type: 'boolean', default: false },
      out: { type: 'string' },
      api: { type: 'string', default: DEFAULT_API },
      cache: { type: 'string', default: DEFAULT_CACHE },
      version: { type: 'boolean', default: false },
    },
  })
  const [command, ...operands] = positionals
  return {
    command,
    operands,
    help: values.help,
    out: values.out,
    api: values.api,
    cache: values.cache,
    version: values.version,
  }
}

async function printVersion(): Promise<number> {
  process.stdout.write(`${await readVersion()}\n`)
  return EXIT_OK
}

function printUsage(code: number): number {
  process.stdout.write(USAGE)
  return code
}

async function validate(operands: readonly string[]): Promise<number> {
  const [dir, ...extra] = operands
  if (dir === undefined || extra.length > NONE) {
    process.stderr.write(
      `shard-format: validate takes one folder or tarball\n\n${USAGE}`,
    )
    return EXIT_USAGE
  }
  try {
    process.stdout.write(`${summary(await validateShardfile(dir))}\n`)
    return EXIT_OK
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error)
    process.stderr.write(
      `shard-format: ${dir} is not a valid shardfile: ${reason}\n`,
    )
    return EXIT_INVALID
  }
}

async function packReport(
  dir: string,
  out: string | undefined,
): Promise<number> {
  try {
    const packed = await packFolder(dir, out)
    const size = `${String(packed.bytes)} bytes`
    process.stdout.write(`packed ${packed.file}: ${size}, ${packed.hash}\n`)
    return EXIT_OK
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error)
    process.stderr.write(`shard-format: ${dir} does not pack: ${reason}\n`)
    return EXIT_INVALID
  }
}

async function pack(args: CliArgs): Promise<number> {
  const [dir, ...extra] = args.operands
  if (dir === undefined || extra.length > NONE) {
    process.stderr.write(`shard-format: pack takes one folder\n\n${USAGE}`)
    return EXIT_USAGE
  }
  return await packReport(dir, args.out)
}

async function corpus(args: CliArgs): Promise<number> {
  if (args.operands.length > NONE) {
    process.stderr.write(`shard-format: corpus takes no operands\n\n${USAGE}`)
    return EXIT_USAGE
  }
  const rows = await runCorpus({
    api: args.api,
    cache: args.cache,
    validator: await readVersion(),
  })
  process.stdout.write(`${corpusReport(rows)}\n`)
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

async function runCommand(args: CliArgs): Promise<number> {
  if (args.command === undefined) {
    return printUsage(EXIT_USAGE)
  }
  if (args.command === 'validate') {
    return await validate(args.operands)
  }
  if (args.command === 'pack') {
    return await pack(args)
  }
  if (args.command === 'corpus') {
    return await corpus(args)
  }
  process.stderr.write(
    `shard-format: unknown command ${args.command}\n\n${USAGE}`,
  )
  return EXIT_USAGE
}

async function main(argv: readonly string[]): Promise<number> {
  const args = parseCliArgs(argv)
  if (args.version) {
    return await printVersion()
  }
  if (args.help) {
    return printUsage(EXIT_OK)
  }
  return await runCommand(args)
}

try {
  process.exitCode = await main(process.argv.slice(FIRST_CLI_ARG))
} catch (error: unknown) {
  process.stderr.write(`shard-format: ${String(error)}\n`)
  process.exitCode = EXIT_CRASH
}
