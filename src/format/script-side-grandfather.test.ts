// oxlint-disable import/max-dependencies, typescript/prefer-readonly-parameter-types -- both validators and pinned products
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { beforeAll, describe, expect, test } from 'vitest'

import { nodeStreamPorts } from './product-stream-node.ts'
import { validateShardfileStream } from './product-stream.ts'
import { prepareAssetDecoders } from './product.ts'
import { validateShardfileProduct } from './productValidation.ts'
import { SCRIPT_SIDE_GRANDFATHER } from './script-side-grandfather.ts'
import { scriptSideVerdict } from './script-sides.ts'
import { writeTar } from './tar.ts'

import type { ProductFiles } from './productValidation.ts'
import type { ScriptSideProduct } from './script-side-grandfather.ts'
import type { NamedJson } from './script-sides.ts'

// SERVER-PARITY SS7 and SS11: Pine's old live product was grandfathered with a warning until SS11 re-uploaded it (Pine
// revision 4, `page.life` on the view row `pine.ambient`); the list is now empty, so every product with the pattern, the
// old Pine product included, is refused. Built products come from engine out/, and their verdict walks every named JSON
// file (SS12's view return rows, `script-view-returns.test.ts`).

type Json = Record<string, unknown>
type Files = ReadonlyMap<string, Uint8Array>

const ROOT = new URL('../../', import.meta.url).pathname
/** Engine's pinned products (`node scripts/pins.ts install`), or another tree's with WILDSHARD_ENGINE_OUT. */
const ENGINE_OUT =
  process.env['WILDSHARD_ENGINE_OUT'] ?? path.join(ROOT, '../engine/out')
const PINE = path.join(ENGINE_OUT, 'pine-hollow')
const LIFE = 'actors/page-life.json'
const PINE_LINE = `sim script pine.life runs in page-only feature page.life (${LIFE}), which no server host runs`
/** Pine's old live product (revision 2, `f45e25f2`), the one product the list grandfathered until SS11. */
const PINE_OLD: ScriptSideProduct = {
  slug: 'pine-hollow',
  sourceHash:
    'a255585456ff289330fc0a8f7b417b67dca608ebeebcec59b676a7b361f79c15',
}

function sha256(bytes: Readonly<Uint8Array>): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function readJson(root: string, file: unknown): Json {
  const text = readFileSync(path.join(root, String(file)), 'utf8')
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a test reads a built product
  return JSON.parse(text) as Json
}

function listed(shard: Json, key: string): Json[] {
  const items = shard[key]
  return Array.isArray(items)
    ? items.filter(
        (item: unknown): item is Json =>
          typeof item === 'object' && item !== null,
      )
    : []
}

/** The value at `keys` under `value`, or `undefined`. */
function pathOf(value: unknown, keys: readonly string[]): unknown {
  let found = value
  for (const key of keys) {
    found =
      typeof found === 'object' && found !== null
        ? Reflect.get(found, key)
        : undefined
  }
  return found
}

/** The verdict on a page.life feature running a `sim` row `id` (its own copy), in `product`. */
function simLifeVerdict(
  id: string,
  product: ScriptSideProduct,
): { refused: string[]; warnings: string[] } {
  const row = { id, side: 'sim' }
  const sections = new Map<string, unknown>([
    ['actors/return-scripts', [row]],
    ['client/plan', { features: [{ file: LIFE, kind: 'page.life' }] }],
  ])
  const named: NamedJson = (name: string): unknown =>
    name === LIFE ? { program: { script: row } } : undefined
  return scriptSideVerdict(sections, { names: [], read: named }, product)
}

/** A built product's verdict, reading its sections, named JSON and identity from disk. */
function productVerdict(root: string): {
  refused: string[]
  warnings: string[]
} {
  const shard = readJson(root, 'shard.json')
  const sections = new Map<string, unknown>()
  for (const entry of listed(shard, 'sections')) {
    sections.set(String(entry['name']), readJson(root, entry['path']))
  }
  const files = listed(shard, 'files')
  const named: NamedJson = (name: string): unknown => {
    const file = files.find((entry: Json): boolean => entry['name'] === name)
    return file === undefined ? undefined : readJson(root, file['path'])
  }
  const names = files.flatMap((entry: Json): string[] =>
    entry['kind'] === 'json' ? [String(entry['name'])] : [],
  )
  return scriptSideVerdict(
    sections,
    { names, read: named },
    {
      slug: String(pathOf(shard, ['identity', 'slug'])),
      sourceHash: String(pathOf(shard, ['build', 'sourceHash'])),
    },
  )
}

/** Every product folder in engine's out/ (none in shardfile's own CI). */
function pinnedProducts(): [string, string][] {
  if (!existsSync(ENGINE_OUT)) {
    return []
  }
  const roots = readdirSync(ENGINE_OUT).map(
    (name: string): [string, string] => [name, path.join(ENGINE_OUT, name)],
  )
  return roots.filter(([, root]: [string, string]): boolean =>
    existsSync(path.join(root, 'shard.json')),
  )
}

/** Pine's shard.json, sections and page-life file: enough for both validators to reach the side check. */
function pineFiles(): Map<string, Uint8Array> {
  const shard = readJson(PINE, 'shard.json')
  const life = listed(shard, 'files').find(
    (entry: Json): boolean => entry['name'] === LIFE,
  )
  const sections = listed(shard, 'sections').map((entry: Json): string =>
    String(entry['path']),
  )
  const files = new Map<string, Uint8Array>()
  for (const file of ['shard.json', ...sections, String(life?.['path'])]) {
    const bytes = readFileSync(path.join(PINE, file))
    files.set(file, new Uint8Array(bytes))
  }
  return files
}

function memoryFiles(files: Files): ProductFiles {
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

beforeAll(async (): Promise<void> => {
  await prepareAssetDecoders()
})

describe('the grandfather list', (): void => {
  test('is empty since SS11', (): void => {
    expect(SCRIPT_SIDE_GRANDFATHER).toEqual([])
  })

  test('refuses the old Pine product, another shard and another script alike', (): void => {
    const line = `sim script x.life runs in page-only feature page.life (${LIFE}), which no server host runs`
    for (const [id, product, refused] of [
      ['pine.life', PINE_OLD, PINE_LINE],
      ['pine.life', { ...PINE_OLD, slug: 'made-up' }, PINE_LINE],
      ['x.life', PINE_OLD, line],
    ] as const) {
      expect(simLifeVerdict(id, product)).toEqual({
        refused: [refused],
        warnings: [],
      })
    }
  })

  test('passes a view row on page.life (Pine revision 4, pine.ambient) with no warning', (): void => {
    const row = { id: 'pine.ambient', side: 'view' }
    const sections = new Map<string, unknown>([
      ['actors/return-scripts', [row]],
      ['client/plan', { features: [{ file: LIFE, kind: 'page.life' }] }],
    ])
    const named: NamedJson = (name: string): unknown =>
      name === LIFE ? { program: { script: row } } : undefined
    const result = scriptSideVerdict(
      sections,
      { names: [], read: named },
      PINE_OLD,
    )
    expect(result).toEqual({ refused: [], warnings: [] })
  })
})

describe('pinned products in engine out/', (): void => {
  const products = pinnedProducts()
  test.skipIf(products.length === 0).each(products)(
    '%s: none is refused and none warns',
    (_name: string, root: string): void => {
      expect(productVerdict(root)).toEqual({ refused: [], warnings: [] })
    },
  )

  test.skipIf(!existsSync(PINE))(
    'both validators admit the pinned Pine product past the side check',
    async (): Promise<void> => {
      const head = pineFiles()
      const old = verdict((): unknown =>
        validateShardfileProduct(memoryFiles(head), { hash: sha256 }),
      )
      expect(old).not.toMatch(/Script side/u)
      expect(await streamVerdict(head)).not.toMatch(/Script side/u)
    },
  )
})
