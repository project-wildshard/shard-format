import { expect, test } from 'vitest'

import {
  native,
  nativeShard,
  nativeSections,
  nativeProduct,
  memoryFiles,
  sha256,
} from '../test/helpers/native-contact.ts'
import { assembleOutputShardfile } from './outputIndex.ts'
import { prepareAssetDecoders } from './shardfile-assets.ts'
import { nodeStreamPorts } from './shardfile-stream-node.ts'
import { validateShardfileStream } from './shardfile-stream.ts'
import { validateShardfileFolder } from './shardfileValidation.ts'
import { parseShardfile } from './shardSchema.ts'
import { writeTar } from './tar.ts'
import { validationSourceBytes } from './validationReceipt.ts'

test('item contact targets use declared native row ids, with the ordinary parser remaining strict', (): void => {
  const shard = nativeShard()
  expect((): unknown => parseShardfile(shard)).toThrow(
    'shardfile semantic rules',
  )
  expect(parseShardfile(shard, nativeSections()).items).toEqual(shard.items)
  expect((): unknown => parseShardfile(shard, new Map())).toThrow()
  for (const value of [
    { page: [], native: [{ ...native, id: native.kind }] },
    { page: [], native: [{ ...native, variants: [] }] },
    { page: [], native: [native], invented: true },
    [native.id],
  ]) {
    const sections = new Map([['actors/species-programs', value]])
    expect((): unknown => parseShardfile(shard, sections)).toThrow()
  }
})
test.each([
  { page: [native], native: [] },
  { page: [], native: [], program: { species: [native], strikes: [] } },
])(
  'page and program declarations follow the same item reference law',
  (value: unknown): void => {
    const shard = nativeShard()
    const sections = new Map([['actors/species-programs', value]])
    expect(parseShardfile(shard, sections).items).toEqual(shard.items)
  },
)
test('actual native contact products pass folder and streaming admission', async (): Promise<void> => {
  await prepareAssetDecoders()
  const { files, sections, index } = nativeProduct()
  const assembled = assembleOutputShardfile(index, sections)
  expect(assembled.items).toEqual(nativeShard().items)
  const product = validateShardfileFolder(memoryFiles(files), { hash: sha256 })
  const tar = writeTar(files)
  async function* chunks(): AsyncIterable<Uint8Array> {
    await Promise.resolve()
    yield tar
  }
  const streamed = await validateShardfileStream(
    chunks,
    nodeStreamPorts({ brotli: false }),
  )
  expect(streamed.shard).toEqual(product.shard)
})
test('native metadata keeps exact bytes and complete product inventories', (): void => {
  const { files, sections, index } = nativeProduct(),
    path = 'sections/actors/species-programs.json'
  const altered = new Map([
    ...files,
    [path, validationSourceBytes({ page: [], native: [] })],
  ])
  expect((): unknown =>
    validateShardfileFolder(memoryFiles(altered), { hash: sha256 }),
  ).toThrow('hash or size mismatch')
  const missing = new Map(files)
  missing.delete(path)
  expect((): unknown =>
    validateShardfileFolder(memoryFiles(missing), { hash: sha256 }),
  ).toThrow()
  const omitted = new Map(sections)
  omitted.delete('actors/species-programs')
  expect((): unknown => assembleOutputShardfile(index, omitted)).toThrow(
    'Missing or surplus output section',
  )
})

test.each([
  { page: [], native: [{ ...native, id: native.kind }] },
  { page: [], native: [{ ...native, variants: [] }] },
])(
  'rehashed native metadata cannot invent a contact target or bypass its defining schema',
  (value: unknown): void => {
    const { files } = nativeProduct(value)
    expect((): unknown =>
      validateShardfileFolder(memoryFiles(files), { hash: sha256 }),
    ).toThrow()
  },
)
