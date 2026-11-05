#!/usr/bin/env node
import { parseArgs } from 'node:util'

import { summary, validateProduct } from './validate.ts'
import { readVersion } from './version.ts'

const EXIT_OK = 0
const EXIT_USAGE = 1
const EXIT_CRASH = 2
const EXIT_INVALID = 3
const NONE = 0

// Arguments start after [node, script] in process.argv.
const FIRST_CLI_ARG = 2

const USAGE = `Usage: shardfile <command> [options]

Commands:
  validate <dir>       Validate a built shardfile product folder (format
                       checks only: schema, inventory, hashes, budgets)

Options:
  --version            Print the version
  --help               Print this help
`

interface CliArgs {
  readonly command: string | undefined
  readonly operands: readonly string[]
  readonly help: boolean
  readonly version: boolean
}

function parseCliArgs(argv: readonly string[]): CliArgs {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      help: { type: 'boolean', default: false },
      version: { type: 'boolean', default: false },
    },
  })
  const [command, ...operands] = positionals
  return { command, operands, help: values.help, version: values.version }
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
    process.stderr.write(`shardfile: validate takes one folder\n\n${USAGE}`)
    return EXIT_USAGE
  }
  try {
    process.stdout.write(`${summary(await validateProduct(dir))}\n`)
    return EXIT_OK
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error)
    process.stderr.write(
      `shardfile: ${dir} is not a valid shardfile: ${reason}\n`,
    )
    return EXIT_INVALID
  }
}

async function runCommand(args: CliArgs): Promise<number> {
  if (args.command === undefined) {
    return printUsage(EXIT_USAGE)
  }
  if (args.command === 'validate') {
    return await validate(args.operands)
  }
  process.stderr.write(`shardfile: unknown command ${args.command}\n\n${USAGE}`)
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
  process.stderr.write(`shardfile: ${String(error)}\n`)
  process.exitCode = EXIT_CRASH
}
