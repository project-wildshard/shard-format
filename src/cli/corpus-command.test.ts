import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'

import { corpusCommand } from './corpus-command.ts'

// QA 11-25 row 128 (opus-zs11, from ZONE-SNAPSHOTS ZS11): `corpus` reads
// production's store, release files and catalogue, so every read it makes
// of a Wildshard host carries the agent marker, through the kit's shared
// helper, or the hourly audit counts the run as a player.

const scratch = mkdtempSync(path.join(tmpdir(), 'shard-format-corpus-marker-'))
after((): void => {
  rmSync(scratch, { recursive: true, force: true })
})

const API = 'https://api.wildshard.io'
const PINS = path.join(scratch, 'pins.json')
writeFileSync(PINS, JSON.stringify({ shards: [] }))

interface Seen {
  readonly url: string
  readonly userAgent: string | null
  readonly header: string | null
}

function answer(url: string): unknown {
  if (url.endsWith('/api/shardfiles')) {
    return { shardfiles: [] }
  }
  if (url.endsWith('-placements.json')) {
    return { body: JSON.stringify({ cells: [] }), signature: 'test' }
  }
  if (new URL(url).host === 'releases.wildshard.io') {
    return { body: JSON.stringify({ shards: [] }), signature: 'test' }
  }
  return { shards: [] }
}

type FetchInit = Parameters<typeof fetch>[1]

/** A network that answers every corpus read with an empty store and records each request's marker. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the test collects into it
function recording(seen: Seen[]): typeof fetch {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- fetch's own signature
  return async (input: unknown, options?: FetchInit): Promise<Response> => {
    const url = input instanceof URL ? input.href : String(input)
    const headers = new Headers(options?.headers)
    seen.push({
      url,
      userAgent: headers.get('user-agent'),
      header: headers.get('x-wildshard-agent'),
    })
    return await Promise.resolve(Response.json(answer(url)))
  }
}

describe('corpus agent marker', (): void => {
  it('marks every read of the API and the releases host', async (): Promise<void> => {
    const seen: Seen[] = []
    const code = await corpusCommand({
      api: API,
      cache: path.join(scratch, 'cache'),
      usage: undefined,
      pins: PINS,
      candidate: undefined,
      only: undefined,
      strictStore: true,
      fetch: recording(seen),
    })
    assert.equal(code, 0)
    const hosts = new Set(
      seen.map((one: Readonly<Seen>): string => new URL(one.url).host),
    )
    assert.deepEqual([...hosts].toSorted(), [
      'api.wildshard.io',
      'releases.wildshard.io',
    ])
    for (const one of seen) {
      assert.match(one.userAgent ?? '', /\bWildshardAgent\/1\b/u, one.url)
      assert.ok((one.header ?? '').length > 0, one.url)
    }
  })
})
