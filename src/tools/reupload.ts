import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { stderr, stdout } from 'node:process'
import { parseArgs } from 'node:util'

import { parse, record, string } from 'valibot'

import { readVersion } from '../cli/version.ts'
import { DEPRECATIONS } from '../format/deprecations.ts'
import { liveIo } from './reupload-live.ts'
import { reupload, reuploadReport } from './reupload-run.ts'

// SHARD-COMPAT CP17 (J486, Q31): `pnpm reupload <deprecation id> [--apply
// --preparation <engine release>] [--api <url>]`. Without --apply it
// prints the plan: per shard whose newest kept revision uses the part,
// whether the API migrates it, which shard repo re-publishes it
// (`corpus/shard-repos.json`), or the needs-author note. With --apply it
// dispatches each shard repo's publish.yml, waits for the new
// revisions and counts again.

const ROOT = path.resolve(import.meta.dirname, '../..')
const REPOS_FILE = path.join(ROOT, 'corpus/shard-repos.json')
const EXIT_OK = 0
const EXIT_FAIL = 1
const Repos = record(string(), string())
const USAGE =
  'usage: pnpm reupload <deprecation id> [--apply --preparation <engine release>] [--api <url>]\n'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    apply: { type: 'boolean', default: false },
    preparation: { type: 'string', default: '' },
    api: { type: 'string', default: 'https://api.wildshard.io' },
    cache: { type: 'string', default: 'tmp/corpus' },
  },
})

/** `corpus/shard-repos.json`: each slug's own shard repo. */
async function readRepos(): Promise<Readonly<Record<string, string>>> {
  const text = await readFile(REPOS_FILE, 'utf8')
  return parse(Repos, JSON.parse(text))
}

async function main(): Promise<number> {
  const [id] = positionals
  const deprecation = DEPRECATIONS.find(
    (row: Readonly<{ id: string }>): boolean => row.id === id,
  )
  if (
    deprecation === undefined ||
    (values.apply && values.preparation === '')
  ) {
    stderr.write(USAGE)
    return EXIT_FAIL
  }
  const result = await reupload({
    deprecation,
    repos: await readRepos(),
    io: liveIo({ ...values, validator: await readVersion() }),
    apply: values.apply,
  })
  stdout.write(`${reuploadReport(result)}\n`)
  const settled = result.republished.every(
    (row: Readonly<{ to: number | undefined }>): boolean =>
      row.to !== undefined,
  )
  return settled ? EXIT_OK : EXIT_FAIL
}

process.exitCode = await main()
