#!/usr/bin/env node
import { parseArgs } from 'node:util'

import { readVersion } from './version.ts'

const EXIT_OK = 0
const EXIT_USAGE = 1
const EXIT_CRASH = 2

// Arguments start after [node, script] in process.argv.
const FIRST_CLI_ARG = 2

const USAGE = `Usage: shardfile <command> [options]

Commands:
  (none yet: they arrive with the import, see docs/plans/)

Options:
  --version            Print the version
  --help               Print this help
`

interface CliArgs {
  readonly command: string | undefined
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
  const [command] = positionals
  return { command, help: values.help, version: values.version }
}

async function printVersion(): Promise<number> {
  process.stdout.write(`${await readVersion()}\n`)
  return EXIT_OK
}

function printUsage(code: number): number {
  process.stdout.write(USAGE)
  return code
}

function runCommand(args: CliArgs): number {
  if (args.command === undefined) {
    return printUsage(EXIT_USAGE)
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
  return runCommand(args)
}

try {
  process.exitCode = await main(process.argv.slice(FIRST_CLI_ARG))
} catch (error: unknown) {
  process.stderr.write(`shardfile: ${String(error)}\n`)
  process.exitCode = EXIT_CRASH
}
