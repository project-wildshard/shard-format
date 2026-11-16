import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { outputSectionPayloads } from '../../format/outputFields.ts'
import { parseOutputIndex } from '../../format/outputIndex.ts'
import { parseShardfileField } from '../../format/shardSchema.ts'
import { validationSourceBytes } from '../../format/validationReceipt.ts'
import { outputFixture } from './output-fixture.ts'

import type { OutputIndex } from '../../format/outputIndex.ts'
import type { ShardfileFiles } from '../../format/shardfileValidation.ts'
import type { Shardfile } from '../../format/shardSchema.ts'

const native = {
  id: 'fixture.shell',
  kind: 'different.kind',
  label: 'Shell',
  variants: [
    { id: 'plain', label: 'Plain', rarity: 'common', weight: 1, scale: [1, 1] },
  ],
}
function nativeShard(): Shardfile {
  const shard = outputFixture()
  const url = new URL(
    '../../format/fixtures/native-contact-items.json',
    import.meta.url,
  )
  shard.items = parseShardfileField(
    'items',
    JSON.parse(readFileSync(url, 'utf8')),
  )
  return shard
}
function nativeSections(): Map<string, unknown> {
  return new Map([['actors/species-programs', { page: [], native: [native] }]])
}
function sha256(bytes: Readonly<Uint8Array>): string {
  return createHash('sha256').update(bytes).digest('hex')
}
interface Product {
  readonly files: Map<string, Uint8Array>
  readonly sections: ReadonlyMap<string, unknown>
  readonly index: OutputIndex
}
function baseProduct(): Pick<Product, 'index' | 'files'> {
  const root = new URL('../fixtures/cli-fixture/', import.meta.url)
  const indexUrl = new URL('shard.json', root)
  const index = parseOutputIndex(JSON.parse(readFileSync(indexUrl, 'utf8')))
  const files = new Map<string, Uint8Array>()
  for (const row of index.files) {
    const url = new URL(row.path, root)
    const bytes = new Uint8Array(readFileSync(url))
    files.set(row.path, bytes)
  }
  return { index, files }
}
function nativeProduct(metadata?: unknown): Product {
  const { index, files } = baseProduct()
  const source = nativeShard()
  const sections = new Map([
    ...outputSectionPayloads(source),
    ...nativeSections(),
  ])
  if (metadata !== undefined) {
    sections.set('actors/species-programs', metadata)
  }
  delete index.packs
  index.sections = [...sections].map(
    ([name, value]: readonly [
      string,
      unknown,
    ]): OutputIndex['sections'][number] => {
      const bytes = validationSourceBytes(value),
        path = `sections/${name}.json`
      files.set(path, bytes)
      return {
        name,
        path,
        bytes: bytes.length,
        hash: sha256(bytes),
        schema: `wildshard:${name}@1`,
      }
    },
  )
  index.build.sourceHash = sha256(validationSourceBytes(source))
  files.set('shard.json', validationSourceBytes(index))
  return { files, sections, index }
}
function memoryFiles(files: ReadonlyMap<string, Uint8Array>): ShardfileFiles {
  return {
    paths: (): Iterable<string> => files.keys(),
    read: (path: string, maxBytes: number): Uint8Array => {
      const bytes = files.get(path)
      if (bytes === undefined || bytes.length > maxBytes) {
        throw new Error(`Missing or oversized: ${path}`)
      }
      return bytes
    },
  }
}

export {
  native,
  nativeShard,
  nativeSections,
  nativeProduct,
  memoryFiles,
  sha256,
}
