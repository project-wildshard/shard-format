#!/usr/bin/env node
import { WIRE_PACKAGE_VERSION } from './src/version.mjs'

const FIRST_CLI_ARGUMENT = 2
const ONE_ARGUMENT = 1
const args = process.argv.slice(FIRST_CLI_ARGUMENT)
const [command] = args
if (args.length === ONE_ARGUMENT && command === '--version') {
  process.stdout.write(`${WIRE_PACKAGE_VERSION}\n`)
} else {
  await import('./lib/cli/main.js')
}
