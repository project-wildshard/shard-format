import { execFile } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { promisify } from 'node:util'

import { array, number, object, parse, string } from 'valibot'

import { runCorpus } from '../cli/corpus.ts'

import type { CorpusRow } from '../cli/corpus.ts'
import type { ReuploadIo } from './reupload-run.ts'

// SHARD-COMPAT CP17: the re-upload tool's live I/O. The corpus is FE3's,
// a dispatch is `gh workflow run publish.yml` on the first-party repo
// (staging, version auto, the given preparation), and settling polls the
// API's listing for the shard's next revision.

interface LiveOptions {
  readonly api: string
  readonly cache: string
  readonly validator: string
  readonly preparation: string
}

// eslint-disable-next-line typescript/strict-void-return -- Node execFile returns a child while its callback supplies the result.
const run = promisify(execFile)
const ORG = 'project-wildshard'
const POLL_MS = 30_000
const WAIT_MS = 3_600_000
const NONE = 0
const ListedRow = object({ slug: string(), revision: number() })
const Listing = object({ shardfiles: array(ListedRow) })

/** The newest revision the API lists for a slug. */
async function newest(api: string, slug: string): Promise<number> {
  const listed = await fetch(new URL('/api/shardfiles', api))
  const body: unknown = await listed.json()
  const revisions = parse(Listing, body)
    .shardfiles.filter(
      (row: Readonly<{ slug: string }>): boolean => row.slug === slug,
    )
    .map((row: Readonly<{ revision: number }>): number => row.revision)
  return Math.max(NONE, ...revisions)
}

async function settle(
  api: string,
  slug: string,
  after: number,
): Promise<number | undefined> {
  const end = Date.now() + WAIT_MS
  for (;;) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- one look per poll
    const found = await newest(api, slug)
    if (found > after) {
      return found
    }
    if (Date.now() > end) {
      return undefined
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- a publish takes minutes
    await delay(POLL_MS)
  }
}

function liveIo(options: Readonly<LiveOptions>): ReuploadIo {
  const { api, cache, validator, preparation } = options
  return {
    corpus: async (): Promise<readonly CorpusRow[]> =>
      await runCorpus({ api, cache, validator }),
    dispatch: async (repo: string, slug: string): Promise<void> => {
      const fields = [
        `slug=${slug}`,
        'channel=staging',
        'version=auto',
        `preparation=${preparation}`,
      ]
      await run('gh', [
        'workflow',
        'run',
        'publish.yml',
        '-R',
        `${ORG}/${repo}`,
        ...fields.flatMap((field: string): readonly string[] => ['-f', field]),
      ])
    },
    settle: async (slug: string, after: number): Promise<number | undefined> =>
      await settle(api, slug, after),
  }
}

export { liveIo }
