import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { brotliCompressSync } from 'node:zlib'

import { corpusReport, isPlainTar, runCorpus } from './corpus.ts'
import { packFolder } from './pack.ts'

import type { CorpusOptions } from './corpus.ts'

// SHARD-COMPAT FE3: the corpus reads the API's list and each original by
// hash, judges it as a stored file, and caches the verdict by hash and
// validator version. The fixture is the CLI's real product.

const FIXTURE = fileURLToPath(
  new URL('../test/fixtures/cli-fixture', import.meta.url),
)
const scratch = mkdtempSync(path.join(tmpdir(), 'shard-format-corpus-'))
after((): void => {
  rmSync(scratch, { recursive: true, force: true })
})

const GOOD = 'a'.repeat(64)
const BROKEN = 'b'.repeat(64)
const API = 'https://api.test'

function listing(): unknown {
  return {
    shardfiles: [
      {
        hash: GOOD,
        storedBytes: 10,
        revisions: [{ shard: 'fixture', revision: 1 }],
      },
      {
        hash: BROKEN,
        storedBytes: 20,
        revisions: [{ shard: 'broken', revision: 2 }],
      },
    ],
  }
}

async function packedFixture(): Promise<Uint8Array> {
  const packed = await packFolder(FIXTURE, path.join(scratch, 'fixture.tar'))
  return new Uint8Array(await readFile(packed.file))
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the test collects into it
function fakeApi(tar: Readonly<Uint8Array>, seen: string[]): typeof fetch {
  const stored = new Uint8Array(brotliCompressSync(tar))
  return async (input: unknown): Promise<Response> => {
    const url = input instanceof URL ? input.pathname : String(input)
    seen.push(url)
    if (url === '/api/shardfiles') {
      return await Promise.resolve(Response.json(listing()))
    }
    if (url === `/api/shardfiles/${GOOD}`) {
      return new Response(stored)
    }
    return new Response(tar.subarray(0, 4096))
  }
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the test collects into it
async function options(seen: string[]): Promise<CorpusOptions> {
  const tar = await packedFixture()
  assert.equal(isPlainTar(tar), true)
  return {
    api: API,
    cache: path.join(scratch, 'cache'),
    validator: '0.0.0-test',
    fetch: fakeApi(tar, seen),
  }
}

describe('shard-format corpus', (): void => {
  it('judges each kept original as stored and lists the failure', async (): Promise<void> => {
    const run = await options([])
    const cold = await runCorpus({ ...run, cache: path.join(scratch, 'cold') })
    assert.deepEqual(
      cold.map((found): string => `${found.verdict} ${found.slug}`),
      ['valid fixture', 'fails broken'],
    )
    assert.match(cold[1]?.reason ?? '', /\S/u)
    assert.match(
      corpusReport(cold),
      /2 kept originals, 1 valid, 1 fail; fetched 2/u,
    )
  })

  it('caches each verdict by original hash and validator version', async (): Promise<void> => {
    const seen: string[] = []
    const run = await options(seen)
    await runCorpus(run)
    seen.length = 0
    const warm = await runCorpus(run)
    assert.deepEqual(seen, ['/api/shardfiles'])
    assert.equal(
      warm.every((found): boolean => found.cached),
      true,
    )
    const next = await runCorpus({ ...run, validator: '0.0.1-test' })
    assert.equal(
      next.some((found): boolean => found.cached),
      false,
    )
  })
})
