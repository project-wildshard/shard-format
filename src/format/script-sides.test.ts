// oxlint-disable import/max-dependencies, typescript/prefer-readonly-parameter-types -- both validators and pinned products
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { safeParse } from 'valibot'
import { beforeAll, describe, expect, test } from 'vitest'

import { DecisionScriptsSchema } from './decisionScripts.ts'
import { nodeStreamPorts } from './product-stream-node.ts'
import { validateShardfileStream } from './product-stream.ts'
import { prepareAssetDecoders } from './product.ts'
import { validateShardfileProduct } from './productValidation.ts'
import {
  PAGE_ONLY_PROGRAM_HOSTS,
  SCRIPT_V1_FEATURE_SIDES,
  SCRIPT_V1_VIEW_COMMANDS,
  SCRIPT_V2_LANE_SIDES,
  pageOnlyHostSides,
  scriptSideRefusals,
} from './script-sides.ts'
import { writeTar } from './tar.ts'

import type { ProductFiles } from './productValidation.ts'
import type { NamedJson } from './script-sides.ts'

// SERVER-PARITY SS7: v1 rows declare `sim` or `view`; a view row writes no gameplay, a sim row a page-only feature
// runs is refused, and v1 sides and v2 lanes map onto SS2's side words.

type Json = Record<string, unknown>
type Files = ReadonlyMap<string, Uint8Array>

const ROOT = new URL('../../', import.meta.url).pathname
const ENGINE_OUT = path.join(ROOT, '../engine/out')
const PINE = path.join(ENGINE_OUT, 'pine-hollow')
const LIFE = 'actors/page-life.json'
const PINE_LINE = `sim script pine.life runs in page-only feature page.life (${LIFE}), which no server host runs`
const COPY_LINE = `page.life program x.life (${LIFE}) is not its actors/return-scripts row`
const GAMEPLAY = ['flag', 'reward', 'spawn', 'grant', 'signal', 'field', 'move']

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

/** A v1 row that passes every row rule, with `changes` applied. */
function scriptRow(changes: Json = {}): Json {
  return {
    abi: '1.0',
    binding: { shard: true },
    commands: ['channel'],
    id: 'x.life',
    module: `blobs/wasm/${'a'.repeat(64)}.wasm`,
    on: ['signal'],
    onFail: 'hold',
    params: {},
    reads: ['field'],
    side: 'sim',
    source: 'behaviour/row.as',
    state: [],
    stateVersion: 1,
    ...changes,
  }
}

function admitted(changes: Json): boolean {
  return safeParse(DecisionScriptsSchema, [scriptRow(changes)]).success
}

function nothing(): unknown {
  return undefined
}

/** The refusals for a page.life feature whose return-scripts row declares `side` and whose file carries `copy`. */
function lifeRefusals(side: string, copy: Json): string[] {
  const sections = new Map<string, unknown>([
    ['actors/return-scripts', [scriptRow({ side })]],
    [
      'client/plan',
      { features: [{ file: LIFE, kind: 'page.life', ranged: 'r' }] },
    ],
  ])
  const named: NamedJson = (name: string): unknown =>
    name === LIFE ? { program: { script: copy } } : undefined
  return scriptSideRefusals(sections, named)
}

/** A built product's refusals, reading its sections and named JSON from disk. */
function productRefusals(root: string): string[] {
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
  return scriptSideRefusals(sections, named)
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

/** Pine's shard.json, sections and page-life file: enough for both validators to reach the SS7 check. */
function pineHead(): Files {
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

describe('v1 side', (): void => {
  test('admits sim and view, and nothing else', (): void => {
    expect([
      admitted({}),
      admitted({ side: 'view' }),
      admitted({ side: 'both' }),
    ]).toEqual([true, true, false])
  })

  test('refuses a view row that writes gameplay, and admits the same commands on sim', (): void => {
    for (const command of GAMEPLAY) {
      const commands = ['channel', command]
      expect([
        admitted({ commands, side: 'view' }),
        admitted({ commands }),
      ]).toEqual([false, true])
    }
    expect(
      admitted({ commands: [...SCRIPT_V1_VIEW_COMMANDS], side: 'view' }),
    ).toBe(true)
  })

  test('maps v1 sides and v2 lanes onto the side table words', (): void => {
    expect(SCRIPT_V1_FEATURE_SIDES).toEqual({ sim: 'both', view: 'view' })
    expect(SCRIPT_V2_LANE_SIDES).toEqual({
      project: 'both',
      sim: 'server',
      view: 'view',
    })
  })
})

describe('scriptSideRefusals', (): void => {
  test('every page-only host is a view feature in the side table', (): void => {
    expect(PAGE_ONLY_PROGRAM_HOSTS.size).toBeGreaterThan(0)
    expect([...new Set(pageOnlyHostSides().values())]).toEqual(['view'])
  })

  test('refuses a sim script page.life runs, and admits a view one', (): void => {
    expect(lifeRefusals('sim', scriptRow())).toEqual([
      `sim script x.life runs in page-only feature page.life (${LIFE}), which no server host runs`,
    ])
    expect(lifeRefusals('view', scriptRow({ side: 'view' }))).toEqual([])
  })

  test('refuses a page.life copy that is not its admitted return row', (): void => {
    expect(lifeRefusals('sim', scriptRow({ side: 'view' }))).toEqual([
      COPY_LINE,
    ])
    expect(
      lifeRefusals('view', scriptRow({ commands: ['flag'], side: 'view' })),
    ).toEqual([COPY_LINE])
  })

  test('leaves a page.life file with no program, and refuses a view row in sim/scripts', (): void => {
    const sections = new Map<string, unknown>([
      [
        'client/plan',
        { features: [{ file: LIFE, kind: 'page.life', ranged: 'r' }] },
      ],
      [
        'sim/scripts',
        [scriptRow({ id: 'a.sim' }), scriptRow({ id: 'b.view', side: 'view' })],
      ],
    ])
    expect(scriptSideRefusals(sections, nothing)).toEqual([
      "view script b.view is in sim/scripts, which only the server's decision host runs",
    ])
  })
})

describe('pinned products in engine out/', (): void => {
  const products = pinnedProducts()
  test.skipIf(products.length === 0).each(products)(
    '%s: only Pine is refused, for pine.life',
    (name: string, root: string): void => {
      expect(productRefusals(root)).toEqual(
        name === 'pine-hollow' ? [PINE_LINE] : [],
      )
    },
  )

  test.skipIf(!existsSync(PINE))(
    'both validators refuse Pine with the same line',
    async (): Promise<void> => {
      const head = pineHead()
      const old = verdict((): unknown =>
        validateShardfileProduct(memoryFiles(head), { hash: sha256 }),
      )
      expect(old).toBe(`Script side refused: ${PINE_LINE}`)
      expect(await streamVerdict(head)).toBe(old)
    },
  )
})
