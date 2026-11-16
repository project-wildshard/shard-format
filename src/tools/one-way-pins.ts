import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import {
  array,
  minValue,
  number,
  object,
  parse,
  pipe,
  regex,
  safeInteger,
  string,
} from 'valibot'

import { readTar } from '../format/tar.ts'
import { productFacts } from './one-way-products.ts'

import type { ProductFacts } from './one-way-products.ts'
import type { SourceFile } from './one-way-source.ts'
import type { InferOutput } from 'valibot'

const MIN_BYTES = 1
const FETCH_TIMEOUT_MS = 30_000
const PinSchema = object({
  slug: string(),
  hash: pipe(string(), regex(/^[a-f0-9]{64}$/u)),
  bytes: pipe(number(), safeInteger(), minValue(MIN_BYTES)),
})
const PinsSchema = object({ shards: array(PinSchema) })
type ProductPin = InferOutput<typeof PinSchema>
const WANTED = new Set([
  'blender-template',
  'template',
  'sunscar-dunes',
  'far-reach',
  'nine-dragon-stack',
  'driftwood-isle',
  'pine-hollow',
  'nalati-grasslands',
])
const decoder = new TextDecoder('utf-8', { fatal: true })

function verifyArchive(
  pin: Readonly<ProductPin>,
  bytes: Readonly<Uint8Array>,
): void {
  if (
    bytes.byteLength !== pin.bytes ||
    createHash('sha256').update(bytes).digest('hex') !== pin.hash
  ) {
    throw new Error(`${pin.slug}: archive differs from the engine pin`)
  }
}
function jsonFiles(
  files: ReadonlyMap<string, Readonly<Uint8Array>>,
): readonly SourceFile[] {
  return [...files]
    .filter(([name]: readonly [string, Readonly<Uint8Array>]): boolean =>
      name.endsWith('.json'),
    )
    .map(
      ([name, bytes]: readonly [string, Readonly<Uint8Array>]): SourceFile => ({
        path: name,
        text: decoder.decode(bytes),
      }),
    )
}
async function cachedArchive(
  pin: Readonly<ProductPin>,
): Promise<Uint8Array | undefined> {
  try {
    return await readFile(
      path.join(os.homedir(), '.cache/wildshard/pins', `${pin.hash}.tar`),
    )
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}
async function remoteArchive(pin: Readonly<ProductPin>): Promise<Uint8Array> {
  const mirror = await fetch(
    `https://github.com/project-wildshard/engine/releases/download/pins/${pin.hash}.tar`,
    { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
  )
  if (mirror.ok) {
    return new Uint8Array(await mirror.arrayBuffer())
  }
  const response = await fetch(
    `https://api.wildshard.io/api/shardfiles/${pin.hash}`,
    { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
  )
  if (!response.ok) {
    throw new Error(`${pin.slug}: pinned archive is unavailable`)
  }
  return new Uint8Array(await response.arrayBuffer())
}
async function readProduct(pin: Readonly<ProductPin>): Promise<ProductFacts> {
  const bytes = (await cachedArchive(pin)) ?? (await remoteArchive(pin))
  verifyArchive(pin, bytes)
  return productFacts(pin.slug, jsonFiles(readTar(bytes)))
}

function enginePins(engine: readonly SourceFile[]): readonly ProductPin[] {
  const file = engine.find(
    (row: Readonly<SourceFile>): boolean =>
      row.path === 'test/pins/shardfiles.json',
  )
  if (file === undefined) {
    throw new Error('The engine snapshot lacks its product pins')
  }
  const parsed: unknown = JSON.parse(file.text)
  const pins = parse(PinsSchema, parsed).shards.filter(
    (pin: Readonly<ProductPin>): boolean => WANTED.has(pin.slug),
  )
  if (
    new Set(pins.map((pin: Readonly<ProductPin>): string => pin.slug)).size !==
      WANTED.size ||
    pins.length !== WANTED.size
  ) {
    throw new Error('The engine pin is missing or repeats an audited shard')
  }
  return pins
}

/** Use the product inventory at the same source revision as the engine counters. */
async function pinnedProducts(
  engine: readonly SourceFile[],
): Promise<readonly ProductFacts[]> {
  const pins = enginePins(engine)
  const products: ProductFacts[] = []
  for (const pin of pins) {
    // eslint-disable-next-line no-await-in-loop -- Keep one large tarball alive at a time.
    const product = await readProduct(pin)
    products.push(product)
  }
  return products
}

export { enginePins, jsonFiles, pinnedProducts, verifyArchive }
export type { ProductPin }
