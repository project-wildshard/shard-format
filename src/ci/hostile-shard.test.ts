import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

import { parseOutputIndex } from '../format/outputIndex.ts'
import { readTar, writeTar } from '../format/tar.ts'
import { validationSourceBytes } from '../format/validationReceipt.ts'
import {
  TEMPLATE_2,
  cli,
  scratch,
  sha256,
  validateHere,
} from '../test/helpers/corpus.ts'

// A shard is an upload from a stranger, and hashes are no defence: a hostile
// author writes correct ones. So these do too, then lie about something else.
// Each goes through what a host runs. No refusal's words are pinned, and the
// control keeps a refusal from passing for the wrong reason.

interface BlobRow {
  readonly hash: string
  readonly kind: string
  readonly path: string
}

type Files = ReadonlyMap<string, Readonly<Uint8Array>>
type Named = readonly [string, Readonly<Uint8Array>]

const INDEX = 'shard.json'
const dir = scratch('hostile')
const decoder = new TextDecoder()

// A fixed walk, so a failure names one input for good.
const FUZZ_INPUTS = 400
const SEED = 186
const LEHMER_MULTIPLIER = 48_271
const LEHMER_MODULUS = 2_147_483_647
// Parsers read their headers first, so most edits land there.
const HEADER_BYTES = 512
const EDITS = 6
const TRUNCATED = 0.2
const ANYWHERE = 0.3
const EVERY_FOURTH = 4

function template2(): Files {
  const tar = path.join(dir, 'template-2.tar')
  assert.equal(cli(['pack', TEMPLATE_2, '--out', tar]).status, 0)
  return readTar(readFileSync(tar))
}

const product = template2()
const indexText = decoder.decode(product.get(INDEX))
const pristine = parseOutputIndex(JSON.parse(indexText))

function withIndex(index: unknown): Files {
  return new Map([...product, [INDEX, validationSourceBytes(index)]])
}

/** A new blob with every row around it true. A pack would give it away. */
function swapBlob(row: BlobRow, bytes: Readonly<Uint8Array>): Files {
  const hash = sha256(bytes)
  const file = row.path.replace(row.hash, hash)
  const files = pristine.files.map((item: BlobRow): BlobRow => {
    const swapped = { ...item, hash, path: file, compressed: bytes.length }
    return item.hash === row.hash ? swapped : item
  })
  const costs = Object.entries(pristine.ktx2Costs ?? {}).map(
    ([key, cost]: readonly [string, unknown]): readonly [string, unknown] => [
      key === row.hash ? hash : key,
      cost,
    ],
  )
  const ktx2Costs = Object.fromEntries(costs)
  const index = { ...pristine, files, ktx2Costs, packs: undefined }
  const kept = [...product].filter(
    ([name]: Named): boolean => name !== row.path,
  )
  return new Map([
    ...kept,
    [file, bytes],
    [INDEX, validationSourceBytes(index)],
  ])
}

function validated(name: string, files: Files): number | null {
  const tar = path.join(dir, `${name}.tar`)
  writeFileSync(tar, writeTar(files))
  return cli(['validate', tar]).status
}

function firstRow(kind: string): BlobRow {
  const row = pristine.files.find(
    (item: BlobRow): boolean => item.kind === kind,
  )
  assert.ok(row !== undefined, `Template 2 has no ${kind}`)
  return row
}

/** A module whose one job is to import what no script may. */
function bannedImportModule(): Uint8Array {
  const text = new TextEncoder()
  const module = text.encode('env')
  const name = text.encode('fetch')
  const imported = [1, module.length, ...module, name.length, ...name, 0, 0]
  const header = [0, 97, 115, 109, 1, 0, 0, 0]
  const types = [1, 4, 1, 96, 0, 0]
  const imports = [2, imported.length, ...imported]
  return Uint8Array.from([...header, ...types, ...imports])
}

test('the control: a true product, encoded again, passes', (): void => {
  assert.equal(validated('control', withIndex(pristine)), 0)
})

test('a path that leaves the shard is refused', (): void => {
  const files = pristine.files.map((row: BlobRow, at: number): BlobRow =>
    at === 0 ? { ...row, path: '../../evil.bin' } : row,
  )
  const index = { ...pristine, files }
  assert.equal(validated('escape', withIndex(index)), 3)
})

test('a file nobody listed is refused', (): void => {
  const extra: Named = ['blobs/bin/unlisted.bin', new Uint8Array(4)]
  assert.equal(validated('unlisted', new Map([...product, extra])), 3)
})

test('an index that lies about its source is refused', (): void => {
  const sourceHash = sha256(new Uint8Array(1))
  const build = { ...pristine.build, sourceHash }
  assert.equal(validated('source', withIndex({ ...pristine, build })), 3)
})

test('a model that understates its cost is refused', (): void => {
  const { hash } = firstRow('glb')
  const files = pristine.files.map((row: BlobRow): unknown =>
    row.hash === hash ? { ...row, gpu: 0, triangles: 0 } : row,
  )
  const index = { ...pristine, files }
  assert.equal(validated('understated', withIndex(index)), 3)
})

test('a script with an import no script may have is refused', (): void => {
  const files = swapBlob(firstRow('wasm'), bannedImportModule())
  assert.equal(validated('banned-import', files), 3)
})

function lehmer(start: number): () => number {
  let seed = start
  return (): number => {
    seed = (seed * LEHMER_MULTIPLIER) % LEHMER_MODULUS
    return seed / LEHMER_MODULUS
  }
}

function edited(
  bytes: Readonly<Uint8Array>,
  random: () => number,
): Readonly<Uint8Array> {
  if (random() < TRUNCATED) {
    return bytes.slice(0, Math.floor(random() * bytes.length))
  }
  const out = Uint8Array.from(bytes)
  const reach = random() < ANYWHERE ? out.length : HEADER_BYTES
  for (let edit = 0; edit < EDITS; edit += 1) {
    const at = Math.floor(random() * Math.min(reach, out.length))
    out[at] = Math.floor(random() * 256)
  }
  return out
}

/** The words a fatal TextDecoder throws on bad UTF-8, read from Node itself. */
function invalidTextMessage(): string {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.of(255))
  } catch (error: unknown) {
    if (error instanceof Error) {
      return error.message
    }
  }
  throw new Error('a fatal TextDecoder took byte 255')
}
const INVALID_TEXT = invalidTextMessage()

/** An error a host can catch, with no sign of a parser running off an end.
 *  Bad UTF-8 is a TypeError and still a refusal: Node's code names it, or,
 *  once a check has tagged it with an issue code (SA41), its exact words. */
function isRefusal(error: unknown): boolean {
  if (!(error instanceof Error) || error instanceof RangeError) {
    return false
  }
  const invalidText =
    ('code' in error && error.code === 'ERR_ENCODING_INVALID_ENCODED_DATA') ||
    error.message === INVALID_TEXT
  return !(error instanceof TypeError) || invalidText
}

/** A blob from `blobs`, or every fourth time the index itself. */
function hostile(
  input: number,
  blobs: readonly BlobRow[],
  random: () => number,
): Files {
  if (input % EVERY_FOURTH === 0) {
    const index = edited(validationSourceBytes(pristine), random)
    return new Map([...product, [INDEX, index]])
  }
  const row = blobs.at(input % blobs.length)
  const bytes = product.get(row?.path ?? '')
  assert.ok(row !== undefined && bytes !== undefined)
  return swapBlob(row, edited(bytes, random))
}

async function check(input: number, files: Files): Promise<void> {
  try {
    await validateHere(files)
  } catch (error: unknown) {
    assert.ok(isRefusal(error), `input ${String(input)}: ${String(error)}`)
  }
}

test('mutated blobs and indexes are refused, never a crash', async (): Promise<void> => {
  const random = lehmer(SEED)
  // Tiles and colliders are most of the rows, and one parser.
  const blobs = pristine.files.filter(
    (row: BlobRow, at: number): boolean =>
      row.kind !== 'bin' || at % EVERY_FOURTH === 0,
  )
  for (let input = 0; input < FUZZ_INPUTS; input += 1) {
    // oxlint-disable-next-line no-await-in-loop -- one at a time: a fixed walk
    await check(input, hostile(input, blobs, random))
  }
})
