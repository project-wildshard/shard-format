// oxlint-disable import/max-dependencies, eslint/max-lines, eslint/max-statements, eslint/max-lines-per-function, typescript/prefer-readonly-parameter-types -- corpus mutations edit their own copies
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { brotliCompressSync, constants } from 'node:zlib'

import { beforeAll, describe, expect, test } from 'vitest'

import { issueCodeOf } from './issue-codes.ts'
import { prepareAssetDecoders } from './shardfile-assets.ts'
import { nodeStreamPorts } from './shardfile-stream-node.ts'
import { validateShardfileStream } from './shardfile-stream.ts'
import { validateShardfileFolder } from './shardfileValidation.ts'
import { indexTar, readTar, writeTar } from './tar.ts'
import { validationSourceBytes } from './validationReceipt.ts'

import type { ShardfileFiles } from './shardfileValidation.ts'

// API-CLOUDFLARE AC6a: the streaming validator gives validateShardfileFolder's verdict, refusal for refusal, on the
// handwritten corpus and its mutations. shardfile-stream-pins.test.ts runs the real pins.

type Files = ReadonlyMap<string, Readonly<Uint8Array>>
type Mutation = readonly [name: string, mutate: () => Files]

const CORPUS = new URL('../../corpus/handwritten/', import.meta.url).pathname
const ODD_CHUNK = 7919

function sha256(bytes: Readonly<Uint8Array>): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function brotli(bytes: Readonly<Uint8Array>): Uint8Array {
  return brotliCompressSync(bytes, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 4 },
  })
}

function corpusFiles(): Files {
  const files = new Map<string, Uint8Array>()
  for (const entry of readdirSync(CORPUS, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) {
      const absolute = path.join(entry.parentPath, entry.name)
      files.set(
        path.relative(CORPUS, absolute).split(path.sep).join('/'),
        new Uint8Array(readFileSync(absolute)),
      )
    }
  }
  return files
}

function memoryFiles(files: Files): ShardfileFiles {
  return {
    read: (file: string, maxBytes: number): Uint8Array => {
      const bytes = files.get(file)
      if (bytes === undefined) {
        throw new Error(`missing file: ${file}`)
      }
      if (bytes.length > maxBytes) {
        throw new Error(`larger than its declared size: ${file}`)
      }
      return new Uint8Array(bytes)
    },
    paths: (): Iterable<string> => files.keys(),
  }
}

/** SHARD-AUTHORING SA41: a refusal as `[code] message`, so each comparison checks the code as well as the words. */
function coded(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return `[${issueCodeOf(error) ?? 'none'}] ${message}`
}

function verdict(run: () => unknown): string {
  try {
    run()
    return 'ok'
  } catch (error) {
    return coded(error)
  }
}

async function* chunked(
  bytes: Readonly<Uint8Array>,
  size: number,
): AsyncGenerator<Uint8Array> {
  for (let at = 0; at < bytes.length; at += size) {
    yield bytes.subarray(at, at + size)
  }
  await Promise.resolve()
}

async function streamVerdict(
  stored: Readonly<Uint8Array>,
  encoded: boolean,
): Promise<string> {
  try {
    await validateShardfileStream(
      (): AsyncIterable<Uint8Array> => chunked(stored, ODD_CHUNK),
      nodeStreamPorts({ brotli: encoded }),
    )
    return 'ok'
  } catch (error) {
    return coded(error)
  }
}

function edited(
  files: Files,
  file: string,
  change: (bytes: Readonly<Uint8Array>) => Uint8Array,
): Files {
  const bytes = files.get(file)
  if (bytes === undefined) {
    throw new Error(`no ${file}`)
  }
  return new Map([...files, [file, change(bytes)]])
}

function without(files: Files, file: string): Files {
  return new Map(
    [...files].filter(
      ([name]: readonly [string, Readonly<Uint8Array>]): boolean =>
        name !== file,
    ),
  )
}

function flipped(at: number): (bytes: Readonly<Uint8Array>) => Uint8Array {
  return (bytes: Readonly<Uint8Array>): Uint8Array => {
    const copy = new Uint8Array(bytes)
    copy[at % copy.length] = 255 - (copy[at % copy.length] ?? 0)
    return copy
  }
}

function first(files: Files, prefix: string, suffix: string): string {
  const found = [...files.keys()].find(
    (name: string): boolean => name.startsWith(prefix) && name.endsWith(suffix),
  )
  if (found === undefined) {
    throw new Error('no such corpus file')
  }
  return found
}

type Json = Record<string, unknown>

function parsed(bytes: Readonly<Uint8Array> | undefined): Json {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a test reads its own corpus
  return JSON.parse(new TextDecoder().decode(bytes)) as Json
}

/** The corpus with one section edited and `shard.json` relisting it (packs dropped, so the asset checks speak first). */
function sectionEdited(
  files: Files,
  name: string,
  change: (value: Json) => void,
): Files {
  const file = `sections/${name}.json`
  const value = parsed(files.get(file))
  change(value)
  const bytes = validationSourceBytes(value)
  const shard = parsed(files.get('shard.json'))
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a test reads its own corpus
  const rows = shard['sections'] as Json[]
  const row = rows.find(
    (candidate: Json): boolean => candidate['name'] === name,
  )
  if (row === undefined) {
    throw new Error(`no section ${name}`)
  }
  row['hash'] = sha256(bytes)
  row['bytes'] = bytes.length
  delete shard['packs']
  return new Map([
    ...files,
    [file, bytes],
    ['shard.json', validationSourceBytes(shard)],
  ])
}

/** The corpus with its first pack's first two members swapped (offsets kept contiguous): the rebuilt hash differs. */
function packSwapped(files: Files): Files {
  const shard = parsed(files.get('shard.json'))
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a test reads its own corpus
  const [pack] = shard['packs'] as {
    entries: { hash: string; offset: number; bytes: number }[]
  }[]
  if (pack === undefined) {
    throw new Error('no pack')
  }
  const [one, two, ...rest] = pack.entries
  if (one === undefined || two === undefined) {
    throw new Error('a short pack')
  }
  let offset = 0
  const entries: { hash: string; offset: number; bytes: number }[] = []
  for (const entry of [two, one, ...rest]) {
    entries.push({ hash: entry.hash, offset, bytes: entry.bytes })
    offset += entry.bytes
  }
  pack.entries = entries
  return new Map([...files, ['shard.json', validationSourceBytes(shard)]])
}

function assetMutations(files: Files): readonly Mutation[] {
  return [
    ['a pack out of member order', (): Files => packSwapped(files)],
    [
      'a prop GLB whose material lost its binding',
      (): Files =>
        sectionEdited(files, 'world/props', (value: Json): void => {
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a test reads its own corpus
          const props = value['props'] as { materials: Json }
          delete props.materials['Clay']
        }),
    ],
    [
      'a semantic refusal, which waits for the inventory',
      (): Files =>
        sectionEdited(files, 'world/tiles', (value: Json): void => {
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a test reads its own corpus
          for (const tile of value['tiles'] as Json[]) {
            tile['drawBounds'] = { min: [0, 0, 0], max: [0.001, 0.001, 0.001] }
          }
        }),
    ],
  ]
}

function mutations(files: Files): readonly Mutation[] {
  const glb = first(files, 'blobs/', '.glb')
  const section = first(files, 'sections/', '.json')
  const extra = new Uint8Array([1, 2, 3])
  return [
    ['a changed blob byte', (): Files => edited(files, glb, flipped(4000))],
    [
      'a changed section byte',
      (): Files => edited(files, section, flipped(10)),
    ],
    [
      'a changed shard.json byte',
      (): Files => edited(files, 'shard.json', flipped(40)),
    ],
    [
      'an unlisted file',
      (): Files => new Map([...files, ['blobs/extra.bin', extra]]),
    ],
    ['a missing blob', (): Files => without(files, glb)],
    ['a missing section', (): Files => without(files, section)],
    [
      'non-canonical shard.json',
      (): Files =>
        edited(
          files,
          'shard.json',
          (bytes: Readonly<Uint8Array>): Uint8Array =>
            new Uint8Array([...bytes, 10]),
        ),
    ],
    [
      'a truncated blob',
      (): Files =>
        edited(files, glb, (bytes: Readonly<Uint8Array>): Uint8Array =>
          bytes.slice(0, -8),
        ),
    ],
  ]
}

/** Tarballs `readTar` refuses: bad padding, bad end blocks, cut short twice. */
function brokenTars(tar: Readonly<Uint8Array>): readonly Uint8Array[] {
  const source = {
    length: tar.length,
    read: (at: number, length: number): Readonly<Uint8Array> =>
      tar.subarray(at, at + length),
  }
  const entry = indexTar(source).get('shard.json')
  if (entry === undefined) {
    throw new Error('no shard.json')
  }
  const padding = new Uint8Array(tar)
  padding[entry.offset + entry.size] = 1
  const ending = new Uint8Array(tar)
  ending[tar.length - 1] = 1
  return [padding, ending, tar.slice(0, -1024), tar.slice(0, 700)]
}

// The old validator needs the GLB decoder ready before it runs; the stream awaits it itself. Await it once here so no
// test's order decides it (a cold worker refused a valid GLB, opus-k7b's push).
beforeAll(async (): Promise<void> => {
  await prepareAssetDecoders()
})

describe('validateShardfileStream on the corpus', (): void => {
  const files = corpusFiles()

  test('passes the corpus complete, with its index and stored hash, as the old validator does', async (): Promise<void> => {
    const tar = writeTar(files)
    const stored = brotli(tar)
    const old = validateShardfileFolder(memoryFiles(readTar(tar)), {
      hash: sha256,
    })
    const result = await validateShardfileStream(
      (): AsyncIterable<Uint8Array> => chunked(stored, ODD_CHUNK),
      nodeStreamPorts({ brotli: true }),
    )
    expect([result.hash, result.bytes, result.tarBytes]).toEqual([
      sha256(stored),
      stored.length,
      tar.length,
    ])
    expect([result.index, result.shard]).toEqual([old.index, old.shard])
    expect([...result.sections.keys()]).toEqual([...old.sections.keys()])
    // The corpus lists 3 packs and carries none: the second read rebuilds their hashes beside the asset checks.
    expect([result.complete, result.pending, result.reads]).toEqual([
      true,
      [],
      2,
    ])
  })

  test.each(assetMutations(files))(
    'refuses %s in the asset or pack checks with the old refusal',
    async (_name: string, mutate: () => Files): Promise<void> => {
      const tar = writeTar(mutate())
      const old = verdict((): unknown =>
        validateShardfileFolder(memoryFiles(readTar(tar)), { hash: sha256 }),
      )
      expect(old).not.toBe('ok')
      expect(old).not.toMatch(/^\[none\]/u)
      expect(old).not.toMatch(/source hash|Output hash/u)
      expect(await streamVerdict(brotli(tar), true)).toBe(old)
    },
  )

  test.each(mutations(files))(
    'refuses %s with the old refusal',
    async (_name: string, mutate: () => Files): Promise<void> => {
      const tar = writeTar(mutate())
      const old = verdict((): unknown =>
        validateShardfileFolder(memoryFiles(readTar(tar)), { hash: sha256 }),
      )
      expect(old).not.toBe('ok')
      expect(old).not.toMatch(/^\[none\]/u)
      expect(await streamVerdict(brotli(tar), true)).toBe(old)
      expect(await streamVerdict(tar, false)).toBe(old)
    },
  )

  test.each(brokenTars(writeTar(files)))(
    'refuses a tarball readTar refuses, with its message (%#)',
    async (broken: Readonly<Uint8Array>): Promise<void> => {
      const old = verdict((): unknown => readTar(broken))
      expect(old).not.toBe('ok')
      expect(old).not.toMatch(/^\[none\]/u)
      expect(await streamVerdict(broken, false)).toBe(old)
    },
  )
})

test('validateShardfileStream refuses a stored object whose Brotli is damaged', async (): Promise<void> => {
  const stored = brotli(writeTar(corpusFiles()))
  const middle = Math.floor(stored.length / 2)
  stored[middle] = 255 - (stored[middle] ?? 0)
  expect(await streamVerdict(stored, true)).not.toBe('ok')
})

test('validateShardfileStream refuses a stored object that changed between its reads', async (): Promise<void> => {
  const files = corpusFiles()
  const tar = writeTar(files)
  const changed = writeTar(
    edited(files, first(files, 'blobs/', '.glb'), flipped(4000)),
  )
  let reads = 0
  const verdictOf = await validateShardfileStream(
    (): AsyncIterable<Uint8Array> => {
      reads += 1
      return chunked(reads === 1 ? tar : changed, ODD_CHUNK)
    },
    nodeStreamPorts({ brotli: false }),
  ).then(
    (): string => 'ok',
    (error: unknown): string => coded(error),
  )
  expect(verdictOf).toBe(
    '[stream-changed] stream: the stored object changed between reads',
  )
})
