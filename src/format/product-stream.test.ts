import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { brotliCompressSync, constants } from 'node:zlib'

import { describe, expect, test } from 'vitest'

import { nodeStreamPorts } from './product-stream-node.ts'
import { validateShardfileStream } from './product-stream.ts'
import { validateShardfileProduct } from './productValidation.ts'
import { indexTar, readTar, writeTar } from './tar.ts'

import type { ProductFiles } from './productValidation.ts'

// API-CLOUDFLARE AC6a: the streaming validator gives validateShardfileProduct's verdict, refusal for refusal, on the
// handwritten corpus and its mutations. product-stream-pins.test.ts runs the real pins.

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

function memoryFiles(files: Files): ProductFiles {
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

function verdict(run: () => unknown): string {
  try {
    run()
    return 'ok'
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
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
      chunked(stored, ODD_CHUNK),
      nodeStreamPorts({ brotli: encoded }),
    )
    return 'ok'
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
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

describe('validateShardfileStream on the corpus', (): void => {
  const files = corpusFiles()

  test('passes the corpus with its index, stored hash and pending checks', async (): Promise<void> => {
    const tar = writeTar(files)
    const stored = brotli(tar)
    const old = validateShardfileProduct(memoryFiles(readTar(tar)), {
      hash: sha256,
    })
    const result = await validateShardfileStream(
      chunked(stored, ODD_CHUNK),
      nodeStreamPorts({ brotli: true }),
    )
    expect([result.hash, result.bytes, result.tarBytes]).toEqual([
      sha256(stored),
      stored.length,
      tar.length,
    ])
    expect([result.index, result.shard]).toEqual([old.index, old.shard])
    expect([...result.sections.keys()]).toEqual([...old.sections.keys()])
    // The corpus lists 3 packs and carries none: their rebuilt hashes wait with the asset checks.
    expect([result.complete, result.pending]).toEqual([
      false,
      ['packs', 'assets'],
    ])
  })

  test.each(mutations(files))(
    'refuses %s with the old refusal',
    async (_name: string, mutate: () => Files): Promise<void> => {
      const tar = writeTar(mutate())
      const old = verdict((): unknown =>
        validateShardfileProduct(memoryFiles(readTar(tar)), { hash: sha256 }),
      )
      expect(old).not.toBe('ok')
      expect(await streamVerdict(brotli(tar), true)).toBe(old)
      expect(await streamVerdict(tar, false)).toBe(old)
    },
  )

  test.each(brokenTars(writeTar(files)))(
    'refuses a tarball readTar refuses, with its message (%#)',
    async (broken: Readonly<Uint8Array>): Promise<void> => {
      const old = verdict((): unknown => readTar(broken))
      expect(old).not.toBe('ok')
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
