import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { readFile, writeFile } from 'node:fs/promises'
import { text } from 'node:stream/consumers'

import { parse } from 'valibot'

import {
  BaselineSchema,
  baselineText,
  compareBaseline,
  countLint,
} from './ratchet.ts'

import type { Baseline } from './ratchet.ts'

// `pnpm lint:format [check|update|init]`: the src/format ratchet (D29).
//   check   fail if any count rose, or fell without `update`
//   update  rewrite the baseline to lower counts; refuses any rise
//   init    write the baseline as it stands (the import commit only)

const TARGET = 'src/format'
// The baseline is generated; oxfmt never judges it.
const BASELINE_PATH = `${TARGET}/ratchet.json`
const ROOT = new URL('../../', import.meta.url)
const BASELINE = new URL(BASELINE_PATH, ROOT)
const EXIT_OK = 0
const EXIT_FAIL = 1
const EXIT_USAGE = 2
const NONE = 0
const SHOWN = 40
const FIRST_ARG = 2
const MODES: readonly string[] = ['check', 'init', 'update']

// Both tools exit 1 when they find something; the report is on stdout. A
// crash leaves stdout unparsable or empty, which fails the check too.
async function output(
  command: string,
  args: readonly string[],
): Promise<string> {
  const child = spawn(command, args, {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const [stdout] = await Promise.all([text(child.stdout), once(child, 'close')])
  return stdout
}

async function measure(): Promise<Baseline> {
  const [lint, formatted] = await Promise.all([
    output('node_modules/.bin/oxlint', [
      '-c',
      'src/.oxlintrc.json',
      '--type-aware',
      '-f',
      'json',
      TARGET,
    ]),
    output('node_modules/.bin/oxfmt', [
      '-c',
      'src/.oxfmtrc.json',
      '--list-different',
      TARGET,
    ]),
  ])
  const lines = formatted.split('\n').map((line: string): string => line.trim())
  const unformatted = lines.filter(
    (line: string): boolean =>
      line.startsWith(`${TARGET}/`) && line !== BASELINE_PATH,
  )
  return { lint: countLint(JSON.parse(lint)), unformatted }
}

function print(title: string, lines: readonly string[]): void {
  if (lines.length === NONE) {
    return
  }
  const shown = lines.slice(NONE, SHOWN)
  const rest = lines.length - shown.length
  const more = rest > NONE ? [`... and ${String(rest)} more`] : []
  const body = [...shown, ...more].map((line: string): string => `  ${line}`)
  process.stdout.write(`${title}\n${body.join('\n')}\n`)
}

async function readBaseline(): Promise<Baseline> {
  const raw: unknown = JSON.parse(await readFile(BASELINE, 'utf8'))
  return parse(BaselineSchema, raw)
}

async function compare(mode: string, current: Baseline): Promise<number> {
  const { rises, drops } = compareBaseline(await readBaseline(), current)
  print('src/format ratchet: rose above the baseline (fix the code):', rises)
  if (rises.length > NONE) {
    return EXIT_FAIL
  }
  if (mode === 'update') {
    await writeFile(BASELINE, baselineText(current))
    process.stdout.write(
      `src/format ratchet: lowered ${String(drops.length)} rows\n`,
    )
    return EXIT_OK
  }
  print(
    'src/format ratchet: below the baseline; run `pnpm lint:format update`:',
    drops,
  )
  return drops.length > NONE ? EXIT_FAIL : EXIT_OK
}

async function main(mode: string): Promise<number> {
  const current = await measure()
  if (mode === 'init') {
    await writeFile(BASELINE, baselineText(current))
    return EXIT_OK
  }
  return await compare(mode, current)
}

const mode = process.argv[FIRST_ARG] ?? 'check'
if (MODES.includes(mode)) {
  process.exitCode = await main(mode)
} else {
  process.stderr.write(`format-ratchet: unknown mode ${mode}\n`)
  process.exitCode = EXIT_USAGE
}
