// oxlint-disable import/max-dependencies, eslint/max-statements, eslint/max-lines-per-function, typescript/no-unsafe-type-assertion, typescript/prefer-readonly-parameter-types -- a test of both validators, on a parsed copy of the corpus index
// FORMAT-PRUNE FP60 (J505): published clients send what their own format required. @wildshard/upload 0.4.22 (the
// oldest supported) checks with format 0.63.0 and 0.4.25 (the newest published) with 0.66.0; both require
// `requires.sdk`, so they send it, and format 0.79.1's strict index refused every upload ("Invalid key: Expected never
// but received sdk"). Both validators now mend an incoming original's deleted fields before the strict parse. CI runs
// this on main and on every release/** branch (`pnpm check` runs `test:format`), so a release can't refuse them again.
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { brotliCompressSync, constants } from 'node:zlib'

import { describe, expect, test } from 'vitest'

import { parseIncomingIndex, validateIncomingSection } from './incoming.ts'
import { assembleOutputShardfile, parseOutputIndex } from './outputIndex.ts'
import { writtenSourceBytes } from './save-revision.ts'
import { nodeStreamPorts } from './shardfile-stream-node.ts'
import { validateShardfileStream } from './shardfile-stream.ts'
import { validateShardfileFolder } from './shardfileValidation.ts'
import { readTar, writeTar } from './tar.ts'
import { validationSourceBytes } from './validationReceipt.ts'

import type { ShardfileFiles } from './shardfileValidation.ts'

type Files = ReadonlyMap<string, Readonly<Uint8Array>>

// The made-up CLI product (format 0.1), ZONE-SNAPSHOTS ZS5 (J507): no stored zone.
const CORPUS = new URL('../test/fixtures/cli-fixture/', import.meta.url)
  .pathname

function corpusFiles(): Map<string, Uint8Array> {
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

const sha256 = (bytes: Readonly<Uint8Array>): string =>
  createHash('sha256').update(bytes).digest('hex')

/** How the client declared `build.sourceHash`: over `requires` as it sent it (what format 0.63.0 and 0.66.0 compute),
 * over the mended `requires`, or wrongly. */
type Declared = 'as sent' | 'as mended' | 'wrong'

/** The corpus as a published client sends it: `requires.sdk` as the format it checks with requires (`0.1`, the spelling
 * format 0.63.0 and 0.66.0 write for a 0.1 file), and its source hash declared as `declared` says. */
function clientFiles(declared: Declared = 'as sent'): Files {
  const files = corpusFiles()
  const raw = JSON.parse(new TextDecoder().decode(files.get('shard.json'))) as {
    requires: Record<string, unknown>
    build: Record<string, unknown>
  }
  const index = parseOutputIndex(raw)
  const sections = new Map(
    index.sections.map((entry): readonly [string, unknown] => [
      entry.name,
      JSON.parse(new TextDecoder().decode(files.get(entry.path))),
    ]),
  )
  const shard = assembleOutputShardfile(index, sections)
  const sent = { ...shard, requires: { ...shard.requires, sdk: '0.1' } }
  const hashed = {
    'as sent': sent,
    'as mended': shard,
    wrong: { ...sent, wrong: 1 },
  }[declared]
  raw.requires['sdk'] = '0.1'
  raw.build['sourceHash'] = sha256(
    writtenSourceBytes(hashed, index.formatVersion),
  )
  files.set('shard.json', validationSourceBytes(raw))
  return files
}

function memoryFiles(files: Files): ShardfileFiles {
  return {
    read: (file: string): Uint8Array => {
      const bytes = files.get(file)
      if (bytes === undefined) {
        throw new Error(`missing file: ${file}`)
      }
      return new Uint8Array(bytes)
    },
    paths: (): Iterable<string> => files.keys(),
  }
}

async function* once(bytes: Readonly<Uint8Array>): AsyncGenerator<Uint8Array> {
  yield new Uint8Array(bytes)
  await Promise.resolve()
}

describe('an upload carrying requires.sdk, as @wildshard/upload 0.4.22 and 0.4.25 send it', (): void => {
  test('the strict index alone still refuses it, so the mend is what admits it', (): void => {
    const raw: unknown = JSON.parse(
      new TextDecoder().decode(clientFiles().get('shard.json')),
    )
    expect((): unknown => parseOutputIndex(raw)).toThrow(/sdk/u)
  })

  test.each(['as sent', 'as mended'] as const)(
    'passes the folder validator, its source hash declared %s',
    (declared: Declared): void => {
      const result = validateShardfileFolder(
        memoryFiles(clientFiles(declared)),
        {
          hash: sha256,
        },
      )
      expect(Object.hasOwn(result.index.requires, 'sdk')).toBe(false)
    },
  )

  test('a wrong source hash is still refused by both validators', async (): Promise<void> => {
    expect((): unknown =>
      validateShardfileFolder(memoryFiles(clientFiles('wrong')), {
        hash: sha256,
      }),
    ).toThrow('declared source hash')
    const stored = writeTar(clientFiles('wrong'))
    await expect(
      validateShardfileStream(
        (): AsyncIterable<Uint8Array> => once(stored),
        nodeStreamPorts({ brotli: false }),
      ),
    ).rejects.toThrow('declared source hash')
  })

  test('passes the streaming check the API runs, with the stored bytes hashed as sent', async (): Promise<void> => {
    const tar = writeTar(clientFiles())
    const stored = brotliCompressSync(tar, {
      params: { [constants.BROTLI_PARAM_QUALITY]: 4 },
    })
    const result = await validateShardfileStream(
      (): AsyncIterable<Uint8Array> => once(stored),
      nodeStreamPorts({ brotli: true }),
    )
    expect(result.hash).toBe(sha256(stored))
    expect(Object.hasOwn(result.index.requires, 'sdk')).toBe(false)
    expect(readTar(tar).get('shard.json')).toEqual(
      clientFiles().get('shard.json'),
    )
  })
})

test('an incoming section is mended of the old grid pointer before its strict check', (): void => {
  const row = { grid: { gridShardfile: 'a.tar', width: 1 } }
  expect((): void => {
    validateIncomingSection('made-up', row)
  }).toThrow('Unknown platform section')
  expect(row).toEqual({ grid: { shardfile: 'a.tar', width: 1 } })
  expect((): void => {
    validateIncomingSection('made-up', { gridShardfile: 'a', shardfile: 'b' })
  }).toThrow('A manifest names its shardfile once')
})

test('an incoming index that is not an object reaches the strict parse unmended', (): void => {
  expect((): unknown => parseIncomingIndex('not an index')).toThrow()
})
