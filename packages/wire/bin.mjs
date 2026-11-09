#!/usr/bin/env node
import { WIRE_PACKAGE_VERSION } from './src/version.mjs'

const FIRST_CLI_ARGUMENT = 2
const EXIT_USAGE = 1
const COMMAND_ARGUMENTS = 1
const args = process.argv.slice(FIRST_CLI_ARGUMENT)
const [command] = args
if (args.length === COMMAND_ARGUMENTS && command === 'check') {
  process.stdout.write(
    'wire check: scaffold only; no contract rules installed\n',
  )
} else if (args.length === COMMAND_ARGUMENTS && command === '--version') {
  process.stdout.write(`${WIRE_PACKAGE_VERSION}\n`)
} else {
  process.stderr.write('Usage: wire check | --version\n')
  process.exitCode = EXIT_USAGE
}
