// oxlint-disable import/max-dependencies, typescript/prefer-readonly-parameter-types -- both validators and their corpus; mutations edit their own copies
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { beforeAll, describe, expect, test } from 'vitest'

import {
  CLIENT_FEATURE_SIDES,
  SIDE_TABLES,
  WORLD_ASSEMBLY_STAGE_SIDES,
  assertSectionSides,
  unsidedKinds,
} from './feature-sides.ts'
import { prepareAssetDecoders } from './shardfile-assets.ts'
import { nodeStreamPorts } from './shardfile-stream-node.ts'
import { validateShardfileStream } from './shardfile-stream.ts'
import { validateShardfileFolder } from './shardfileValidation.ts'
import { writeTar } from './tar.ts'
import { validationSourceBytes } from './validationReceipt.ts'

import type { ShardfileFiles } from './shardfileValidation.ts'

// SERVER-PARITY SS2: every client/plan feature kind and world.assembly stage kind has a side, and both validators
// refuse a product that names a kind without one.

type Json = Record<string, unknown>
type Files = ReadonlyMap<string, Uint8Array>

const ROOT = new URL('../../', import.meta.url).pathname
const CORPUS = path.join(ROOT, 'corpus/handwritten')
const ENGINE_OUT = path.join(ROOT, '../engine/out')
const STAGE_KINDS = 18

function sha256(bytes: Readonly<Uint8Array>): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function parsed(bytes: Readonly<Uint8Array> | string | undefined): Json {
  const text =
    typeof bytes === 'string' ? bytes : new TextDecoder().decode(bytes)
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a test reads its own corpus
  return JSON.parse(text) as Json
}

function folderFiles(root: string): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>()
  for (const entry of readdirSync(root, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) {
      const absolute = path.join(entry.parentPath, entry.name)
      files.set(
        path.relative(root, absolute).split(path.sep).join('/'),
        new Uint8Array(readFileSync(absolute)),
      )
    }
  }
  return files
}

function memoryFiles(files: Files): ShardfileFiles {
  return {
    paths: (): Iterable<string> => files.keys(),
    read: (file: string, maxBytes: number): Uint8Array => {
      const bytes = files.get(file)
      if (bytes === undefined || bytes.length > maxBytes) {
        throw new Error(`missing or oversized file: ${file}`)
      }
      return bytes
    },
  }
}

/** `files` with `file` replaced by `bytes` and relisted as client/plan in `shard.json`. */
function relisted(files: Files, file: string, bytes: Uint8Array): Files {
  const shard = parsed(files.get('shard.json'))
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a test reads its own corpus
  const row = (shard['sections'] as Json[]).find(
    (candidate: Json): boolean => candidate['name'] === 'client/plan',
  )
  if (row === undefined) {
    throw new Error('corpus has no client/plan')
  }
  Object.assign(row, { bytes: bytes.length, hash: sha256(bytes) })
  delete shard['packs']
  return new Map([
    ...files,
    [file, bytes],
    ['shard.json', validationSourceBytes(shard)],
  ])
}

/** The corpus with its client/plan edited and `shard.json` relisting it (packs dropped, as shardfile-stream.test does). */
function planEdited(files: Files, change: (plan: Json) => void): Files {
  const file = 'sections/client/plan.json'
  const plan = parsed(files.get(file))
  change(plan)
  return relisted(files, file, validationSourceBytes(plan))
}

function verdict(run: () => unknown): string {
  try {
    run()
    return 'ok'
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

async function* single(bytes: Uint8Array): AsyncIterable<Uint8Array> {
  yield await Promise.resolve(bytes)
}

async function streamVerdict(files: Files): Promise<string> {
  const tar = writeTar(files)
  try {
    await validateShardfileStream(
      (): AsyncIterable<Uint8Array> => single(tar),
      nodeStreamPorts({ brotli: false }),
    )
    return 'ok'
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

/** Every product folder in engine's out/ (none in shardfile's own CI). */
function pinnedProducts(): [string, string][] {
  if (!existsSync(ENGINE_OUT)) {
    return []
  }
  const products: [string, string][] = []
  for (const entry of readdirSync(ENGINE_OUT, { withFileTypes: true })) {
    if (
      entry.isDirectory() &&
      existsSync(path.join(ENGINE_OUT, entry.name, 'shard.json'))
    ) {
      products.push([entry.name, path.join(ENGINE_OUT, entry.name)])
    }
  }
  return products
}

beforeAll(async (): Promise<void> => {
  await prepareAssetDecoders()
})

describe('the side table', (): void => {
  test('names a server installer for every both or server entry', (): void => {
    for (const entry of [
      ...Object.values(CLIENT_FEATURE_SIDES),
      ...Object.values(WORLD_ASSEMBLY_STAGE_SIDES),
    ]) {
      if (entry.side !== 'view') {
        expect(entry.server).toMatch(/^[a-z][a-zA-Z]*$/u)
      }
    }
  })

  test('covers all 18 world.assembly stage kinds', (): void => {
    expect(Object.keys(WORLD_ASSEMBLY_STAGE_SIDES)).toHaveLength(STAGE_KINDS)
  })

  test('the gameplay kinds the audit found page-only are both, never view', (): void => {
    for (const kind of [
      'stealth.entry',
      'world.movers',
      'world.runtime-hooks',
      'player.enter',
      'quest.continuation',
    ] as const) {
      expect(CLIENT_FEATURE_SIDES[kind].side).toBe('both')
    }
    expect(WORLD_ASSEMBLY_STAGE_SIDES['rope-deck']).toEqual({
      server: 'ropeDecks',
      side: 'both',
    })
  })
})

describe('assertSectionSides', (): void => {
  test('refuses a made-up feature kind and a made-up stage kind by name', (): void => {
    const stages = [
      { id: 'a', kind: 'place' },
      { id: 'b', kind: 'teleporter' },
    ]
    const plan = {
      features: [
        { kind: 'world.made-up' },
        { kind: 'world.assembly', rows: { stages } },
      ],
      version: 1,
    }
    expect(unsidedKinds(plan)).toEqual([
      'client/plan world.made-up',
      'world.assembly teleporter',
    ])
    expect((): void => {
      assertSectionSides('client/plan', plan)
    }).toThrow(/^Unsided content kind.*world\.made-up.*teleporter$/u)
  })

  test('refuses a real kind once its entry is missing', (): void => {
    const { 'stealth.entry': _gone, ...features } = SIDE_TABLES.features
    const plan = { features: [{ kind: 'stealth.entry' }], version: 1 }
    expect((): void => {
      assertSectionSides('client/plan', plan, { ...SIDE_TABLES, features })
    }).toThrow('client/plan stealth.entry')
  })

  test('leaves other sections and malformed rows to their schemas', (): void => {
    expect((): void => {
      assertSectionSides('world/movers', {
        features: [{ kind: 'world.made-up' }],
      })
    }).not.toThrow()
    expect(
      unsidedKinds({ features: [3, 'x', { kind: 7 }], version: 1 }),
    ).toEqual([])
    expect(unsidedKinds('not a plan')).toEqual([])
  })
})

describe('both validators', (): void => {
  const corpus = folderFiles(CORPUS)

  test('admit the handwritten corpus', async (): Promise<void> => {
    expect(
      verdict((): unknown =>
        validateShardfileFolder(memoryFiles(corpus), { hash: sha256 }),
      ),
    ).toBe('ok')
    expect(await streamVerdict(corpus)).toBe('ok')
  })

  test('refuse a product with a made-up client/plan kind, with one refusal', async (): Promise<void> => {
    const files = planEdited(corpus, (plan: Json): void => {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a test reads its own corpus
      ;(plan['features'] as Json[]).push({ kind: 'world.made-up' })
    })
    const old = verdict((): unknown =>
      validateShardfileFolder(memoryFiles(files), { hash: sha256 }),
    )
    expect(old).toBe(
      'Unsided content kind (no view, both or server entry): client/plan world.made-up',
    )
    expect(await streamVerdict(files)).toBe(old)
  })
})

// Full validation of each pinned product is `shardfile validate`'s job; this reads only their client/plan.
describe('pinned products in engine out/', (): void => {
  const products = pinnedProducts()
  // CI has no engine out/, and a suite of zero tests is an error in vitest:
  // this one says why the per-product checks below don't run.
  test.skipIf(products.length > 0)(
    'no pinned products in engine out/ to check',
    (): void => {
      expect(products).toEqual([])
    },
  )
  test.skipIf(products.length === 0).each(products)(
    '%s declares a side for every kind',
    (_name: string, root: string): void => {
      const shard = parsed(readFileSync(path.join(root, 'shard.json'), 'utf8'))
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a test reads a built product
      const entry = (shard['sections'] as Json[]).find(
        (row: Json): boolean => row['name'] === 'client/plan',
      )
      if (entry !== undefined) {
        const plan = readFileSync(
          path.join(root, String(entry['path'])),
          'utf8',
        )
        expect(unsidedKinds(parsed(plan))).toEqual([])
      }
    },
  )
})
