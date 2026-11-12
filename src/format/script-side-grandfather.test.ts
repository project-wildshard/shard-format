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

// SERVER-PARITY SS7 and SS11: Pine's live product is grandfathered with a warning until SS11 re-uploads it; any other
// product with the pattern, a new Pine upload included, is still refused. Built products come from engine out/.

type Json = Record<string, unknown>
type Files = ReadonlyMap<string, Uint8Array>

const ROOT = new URL('../../', import.meta.url).pathname
const ENGINE_OUT = path.join(ROOT, '../engine/out')
const PINE = path.join(ENGINE_OUT, 'pine-hollow')
const LIFE = 'actors/page-life.json'
const PINE_LINE = `sim script pine.life runs in page-only feature page.life (${LIFE}), which no server host runs`
/** Pine's live product: engine out/ and the live pin (engine test/pins/shardfiles.json, f45e25f2) share it. */
const PINE_LIVE: ScriptSideProduct = {
  slug: 'pine-hollow',
  sourceHash:
    'a255585456ff289330fc0a8f7b417b67dca608ebeebcec59b676a7b361f79c15',
}
const PINE_NEXT = '0'.repeat(64)
const PINE_WARNING = `grandfathered: ${PINE_LINE} (pine-hollow: the live product; SS5 (engine 2f5e6965) runs its hollow-log secret on the server too, and SS11 moves its page half to a view row)`

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
  return scriptSideVerdict(sections, named, product)
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
  return scriptSideVerdict(sections, named, {
    slug: String(pathOf(shard, ['identity', 'slug'])),
    sourceHash: String(pathOf(shard, ['build', 'sourceHash'])),
  })
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

/** Pine's sections and page-life file, by path. */
function pineFiles(): Map<string, Uint8Array> {
  const shard = readJson(PINE, 'shard.json')
  const life = listed(shard, 'files').find(
    (entry: Json): boolean => entry['name'] === LIFE,
  )
  const sections = listed(shard, 'sections').map((entry: Json): string =>
    String(entry['path']),
  )
  const files = new Map<string, Uint8Array>()
  for (const file of [...sections, String(life?.['path'])]) {
    const bytes = readFileSync(path.join(PINE, file))
    files.set(file, new Uint8Array(bytes))
  }
  return files
}

/** Pine's shard.json, sections and page-life file: enough for both validators to reach the SS7 check. `sourceHash`
 *  replaces the declared source hash, as a new upload of Pine would. */
function pineHead(sourceHash: string): Files {
  const files = pineFiles()
  const index = readFileSync(path.join(PINE, 'shard.json'), 'utf8')
  const next = index.replace(PINE_LIVE.sourceHash, sourceHash)
  files.set('shard.json', new TextEncoder().encode(next))
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
  test('holds only Pine live pine.life, one line per product', (): void => {
    expect(
      SCRIPT_SIDE_GRANDFATHER.map((entry): string[] => [
        entry.slug,
        entry.sourceHash,
        entry.script,
      ]),
    ).toEqual([[PINE_LIVE.slug, PINE_LIVE.sourceHash, 'pine.life']])
  })

  test('turns Pine live pine.life refusal into a warning naming the script and why', (): void => {
    expect(simLifeVerdict('pine.life', PINE_LIVE)).toEqual({
      refused: [],
      warnings: [PINE_WARNING],
    })
  })

  test('still refuses a new Pine upload, another shard and another script', (): void => {
    const line = `sim script x.life runs in page-only feature page.life (${LIFE}), which no server host runs`
    for (const [id, product, refused] of [
      ['pine.life', { ...PINE_LIVE, sourceHash: PINE_NEXT }, PINE_LINE],
      ['pine.life', { ...PINE_LIVE, slug: 'made-up' }, PINE_LINE],
      ['x.life', PINE_LIVE, line],
    ] as const) {
      expect(simLifeVerdict(id, product)).toEqual({
        refused: [refused],
        warnings: [],
      })
    }
  })
})

describe('pinned products in engine out/', (): void => {
  const products = pinnedProducts()
  test.skipIf(products.length === 0).each(products)(
    '%s: none is refused, and only Pine warns, for pine.life',
    (name: string, root: string): void => {
      expect(productVerdict(root)).toEqual({
        refused: [],
        warnings: name === 'pine-hollow' ? [PINE_WARNING] : [],
      })
    },
  )

  test.skipIf(!existsSync(PINE))(
    'both validators refuse a new Pine upload that keeps the pattern, with the same line',
    async (): Promise<void> => {
      const head = pineHead(PINE_NEXT)
      const old = verdict((): unknown =>
        validateShardfileProduct(memoryFiles(head), { hash: sha256 }),
      )
      expect(old).toBe(`Script side refused: ${PINE_LINE}`)
      expect(await streamVerdict(head)).toBe(old)
    },
  )

  test.skipIf(!existsSync(PINE))(
    'both validators pass Pine live head through the side check',
    async (): Promise<void> => {
      const head = pineHead(PINE_LIVE.sourceHash)
      const old = verdict((): unknown =>
        validateShardfileProduct(memoryFiles(head), { hash: sha256 }),
      )
      expect(old).not.toMatch(/Script side/u)
      expect(await streamVerdict(head)).not.toMatch(/Script side/u)
    },
  )
})
