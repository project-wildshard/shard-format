// oxlint-disable typescript/prefer-readonly-parameter-types -- test rows and product files are only read
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'

import { beforeAll, describe, expect, test } from 'vitest'

import { nodeStreamPorts } from './product-stream-node.ts'
import { validateShardfileStream } from './product-stream.ts'
import { prepareAssetDecoders } from './product.ts'
import { validateShardfileProduct } from './productValidation.ts'
import { viewReturnRefusals } from './script-view-returns.ts'
import { writeTar } from './tar.ts'
import { validationSourceBytes } from './validationReceipt.ts'

import type { ProductFiles } from './productValidation.ts'

// SERVER-PARITY SS12 (engine 1e99d663): the server never loads a `view` return row (`serverReturnRows`), so a program
// that runs one anywhere the server may read it fails at install (`Missing admitted raw return module loan`). Only a
// page-only host's program path may run a view row. Driftwood's built product comes from engine out/.

type Json = Record<string, unknown>
type Files = ReadonlyMap<string, Uint8Array>

const LIFE = 'actors/page-life.json'
const SHELTER = 'actors/shelter.json'
const TAIL = 'which the server may run; only a page-only host runs a view row'
const DRIFTWOOD = new URL('../../../engine/out/driftwood-isle', import.meta.url)
  .pathname
const RETURNS = 'actors/return-scripts'
/** `script-sides.ts`'s page-only host; the validator test below runs the real table. */
const LIFE_HOST = new Map([['page.life', ['program', 'script']]])

/** A v1 return row, with `changes` applied. */
function scriptRow(changes: Json = {}): Json {
  return {
    commands: ['channel'],
    id: 'x.life',
    module: `blobs/wasm/${'a'.repeat(64)}.wasm`,
    side: 'sim',
    ...changes,
  }
}

const VIEW_ROW = scriptRow({ side: 'view' })

/** A raw program running `script`. */
function program(script: Json): Json {
  return { bytes: '', script }
}

/** The refusals for a product whose return row is `row`, with a page.life feature, named `files` and `sections`. */
function refusals(
  row: Json,
  files: Readonly<Record<string, unknown>>,
  sections: Readonly<Record<string, unknown>> = {},
): string[] {
  const plan = { features: [{ file: LIFE, kind: 'page.life', ranged: 'r' }] }
  const all = new Map<string, unknown>([
    [RETURNS, [row]],
    ['client/plan', plan],
    ...Object.entries(sections),
  ])
  return viewReturnRefusals(
    all,
    { names: Object.keys(files), read: (name: string): unknown => files[name] },
    LIFE_HOST,
  )
}

describe('a view return row is refused outside a page-only host', (): void => {
  test('in a named file the server may read', (): void => {
    expect(
      refusals(VIEW_ROW, {
        [LIFE]: { program: program(VIEW_ROW) },
        [SHELTER]: { program: program(VIEW_ROW) },
      }),
    ).toEqual([
      `view script x.life is a program in ${SHELTER} (program), ${TAIL}`,
    ])
  })

  test('in a section, nested, or matched by its module alone', (): void => {
    const other = scriptRow({ id: 'other.id' })
    const sections = {
      'quests/runtime': { fights: [{ program: program(VIEW_ROW) }] },
      'world/weather': { reactions: program(other) },
    }
    expect(refusals(VIEW_ROW, {}, sections)).toEqual([
      `view script x.life is a program in quests/runtime (fights.0.program), ${TAIL}`,
      `view script x.life is a program in world/weather (reactions), ${TAIL}`,
    ])
  })

  test('at another path of a page-only file', (): void => {
    const life = { extra: program(VIEW_ROW), program: program(VIEW_ROW) }
    expect(refusals(VIEW_ROW, { [LIFE]: life })).toEqual([
      `view script x.life is a program in ${LIFE} (extra), ${TAIL}`,
    ])
  })
})

describe('a view return row is not refused', (): void => {
  test('a program with the view row id on another module, inline bytes or not', (): void => {
    const own = scriptRow({ module: `blobs/wasm/${'b'.repeat(64)}.wasm` })
    const inline = { bytes: 'AGFzbQ==', script: VIEW_ROW }
    expect(
      refusals(VIEW_ROW, { [SHELTER]: { program: program(own) } }),
    ).toEqual([])
    expect(refusals(VIEW_ROW, { [SHELTER]: { program: inline } })).toEqual([
      `view script x.life is a program in ${SHELTER} (program), ${TAIL}`,
    ])
  })

  test('a host whose script sits at the root of its file', (): void => {
    const sections = new Map<string, unknown>([
      [RETURNS, [VIEW_ROW]],
      ['client/plan', { features: [{ file: LIFE, kind: 'root.host' }] }],
    ])
    const files = {
      names: [LIFE],
      read: (): unknown => program(VIEW_ROW),
    }
    const hosts = new Map([['root.host', ['script']]])
    expect(viewReturnRefusals(sections, files, hosts)).toEqual([])
  })

  test('page.life program, and sim rows anywhere', (): void => {
    expect(
      refusals(VIEW_ROW, { [LIFE]: { program: program(VIEW_ROW) } }),
    ).toEqual([])
    const sim = scriptRow({ id: 'x.sim' })
    expect(refusals(sim, { [SHELTER]: { program: program(sim) } })).toEqual([])
  })
})

function sha256(bytes: Readonly<Uint8Array>): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function readJson(file: string): Json {
  const text = readFileSync(`${DRIFTWOOD}/${file}`, 'utf8')
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

/** Driftwood's return rows, each declared `view`, as canonical bytes. */
function viewReturns(file: string): Uint8Array {
  const views: Json[] = []
  for (const row of listed({ rows: readJson(file) }, 'rows')) {
    views.push({ ...row, side: 'view' })
  }
  return validationSourceBytes(views)
}

/** Driftwood's index with its return-scripts section listed as `bytes`, and no packs (they list the old hash; the
 *  side check runs before packs are read). */
function viewIndex(shard: Json, bytes: Uint8Array): Uint8Array {
  const sections: Json[] = []
  for (const entry of listed(shard, 'sections')) {
    const own = entry['name'] === RETURNS
    const hash = sha256(bytes)
    sections.push(own ? { ...entry, bytes: bytes.length, hash } : entry)
  }
  return validationSourceBytes({ ...shard, packs: [], sections })
}

/** Driftwood's sections and named JSON files, by path, as built. */
function builtFiles(shard: Json): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>()
  const json = listed(shard, 'files').filter(
    (entry: Json): boolean => entry['kind'] === 'json',
  )
  for (const entry of [...listed(shard, 'sections'), ...json]) {
    const file = String(entry['path'])
    const bytes = readFileSync(`${DRIFTWOOD}/${file}`)
    files.set(file, new Uint8Array(bytes))
  }
  return files
}

/** Driftwood's shard.json, sections and named JSON, with its return rows declared `view`. */
function driftwoodViewHead(): Files {
  const shard = readJson('shard.json')
  const files = builtFiles(shard)
  const returns = `sections/${RETURNS}.json`
  const bytes = viewReturns(returns)
  files.set(returns, bytes)
  files.set('shard.json', viewIndex(shard, bytes))
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

async function* single(bytes: Uint8Array): AsyncIterable<Uint8Array> {
  yield await Promise.resolve(bytes)
}

async function verdicts(files: Files): Promise<string[]> {
  const messages: string[] = []
  for (const run of [
    (): unknown =>
      validateShardfileProduct(memoryFiles(files), { hash: sha256 }),
    async (): Promise<unknown> =>
      await validateShardfileStream(
        (): AsyncIterable<Uint8Array> => single(writeTar(files)),
        nodeStreamPorts({ brotli: false }),
      ),
  ]) {
    try {
      // oxlint-disable-next-line no-await-in-loop -- two validators, in order
      await run()
      messages.push('ok')
    } catch (error) {
      messages.push(error instanceof Error ? error.message : String(error))
    }
  }
  return messages
}

beforeAll(async (): Promise<void> => {
  await prepareAssetDecoders()
})

describe('a built product', (): void => {
  test.skipIf(!existsSync(DRIFTWOOD))(
    'both validators refuse Driftwood with its return row declared view, naming every server-read program',
    async (): Promise<void> => {
      const [old, stream] = await verdicts(driftwoodViewHead())
      for (const at of [
        'sim/returns.json (program)',
        'actors/projection.json (practice.program)',
        'poses/monkey.json (program)',
      ]) {
        expect(old).toContain(
          `view script driftwood.returns is a program in ${at}, ${TAIL}`,
        )
      }
      expect(old).toMatch(/^Script side refused: /u)
      expect(stream).toBe(old)
    },
  )
})
