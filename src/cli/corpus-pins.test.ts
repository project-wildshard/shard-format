import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { readPins, withPins } from './corpus-pins.ts'

// SHARD-COMPAT FE13, the pins half: engine's pins join the corpus run.

const LISTED = 'a'.repeat(64)
const PINNED_ONLY = 'b'.repeat(64)

describe('engine pins in the corpus (FE13)', (): void => {
  it('a pinned original the public list leaves out joins the run once', async (): Promise<void> => {
    const pinsJson = JSON.stringify({
      api: 'https://api.wildshard.io',
      shards: [
        { slug: 'dunes', revision: 4, hash: LISTED, bytes: 10 },
        { slug: 'pine-hollow', uploadNumber: 3, hash: PINNED_ONLY, bytes: 20 },
      ],
    })
    const get: typeof fetch = async (): Promise<Response> =>
      await Promise.resolve(new Response(pinsJson))
    const pins = await readPins('https://example.test/pins.json', get)

    const records = withPins(
      [
        {
          hash: LISTED,
          storedBytes: 10,
          revisions: [{ shard: 'dunes', revision: 4 }],
        },
      ],
      pins,
    )

    assert.deepEqual(
      records.map((stored: Readonly<{ hash: string }>): string => stored.hash),
      [LISTED, PINNED_ONLY],
    )
    assert.deepEqual(records[1]?.revisions, [
      { shard: 'pine-hollow', revision: 3 },
    ])
  })
})
