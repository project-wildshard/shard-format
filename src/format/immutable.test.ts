// oxlint-disable unicorn/no-null -- JSON null is a fixture value
import { readFileSync, readdirSync } from 'node:fs'

import { expect, test } from 'vitest'

import { encodeCanonicalJson, hashImmutableBytes } from './immutable.ts'
import { parseShardfileField } from './shardSchema.ts'
import { SHARDFILE_VERSION } from './version.ts'

// SHARD-COMPAT SI1: these bytes and hashes are engine 26979378's
// src/shared/host/immutable.ts output for the same inputs. A change here
// renames every immutable output an author tool has already written.

const encoder = new TextEncoder()
const separator = String.fromCodePoint(0x20_28)

const fixtures = [
  {
    name: 'a shardfile-shaped object',
    value: {
      version: 3,
      identity: { slug: 'far-reach', name: 'Far Reach' },
      files: { 'tiles/b.bin': 'ab12', 'a.json': 'cd34' },
      accent: [0.25, 1, 0],
      requires: [],
    },
    text: '{"accent":[0.25,1,0],"files":{"a.json":"cd34","tiles/b.bin":"ab12"},"identity":{"name":"Far Reach","slug":"far-reach"},"requires":[],"version":3}\n',
    bytes: 146,
    sha256: '0c1f74cc629926243d1c7ee25eda0a33db80fcad9a31f74fdf5d4f5a5895be42',
  },
  {
    name: 'integer-like, empty, upper-case and non-ASCII keys; -0, 1e21, escapes',
    value: {
      zulu: null,
      Bravo: [{ yankee: -0, xray: 1e21 }, 1.5e-7, true, false],
      alpha: `é ${separator} "q" \\ \n tab\t 😀`,
      éclair: {},
      '': [],
      '10': 'ten',
      '9': 'nine',
      alphaalpha: [[], [{}]],
    },
    text: `{"9":"nine","10":"ten","":[],"Bravo":[{"xray":1e+21,"yankee":0},1.5e-7,true,false],"alpha":"é ${separator} \\"q\\" \\\\ \\n tab\\t 😀","alphaalpha":[[],[{}]],"zulu":null,"éclair":{}}\n`,
    bytes: 172,
    sha256: '6ea47c0fdd5d3a2eb1154977a2ba3f8313ef982bea71ada5c30f7220b1a0ba6f',
  },
  {
    name: 'a top-level array',
    value: [3, 'x', { bravo: 2, alpha: 1 }, null],
    text: '[3,"x",{"alpha":1,"bravo":2},null]\n',
    bytes: 35,
    sha256: 'e87c8d158e60ed53e66860a46a91a5ced18480ff7bff811b4ede8b44ede7a513',
  },
] as const

test.each(fixtures)(
  'canonical bytes and sha256 match engine 26979378: $name',
  ({ value, text, bytes, sha256 }): void => {
    const encoded = encodeCanonicalJson(value)
    expect(encoded).toBe(text)
    const wire = encoder.encode(encoded)
    expect(wire.byteLength).toBe(bytes)
    expect(hashImmutableBytes(wire)).toBe(sha256)
  },
)

test('hashImmutableBytes hashes raw bytes, not text', (): void => {
  const all = new Uint8Array(256)
  for (const index of all.keys()) {
    all[index] = index
  }
  expect(hashImmutableBytes(all)).toBe(
    '40aff2e9d2d8922e47afd4648e6967497158785fbd1da870e7110266bf944880',
  )
  expect(hashImmutableBytes(new Uint8Array(0))).toBe(
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  )
})

test('encodeCanonicalJson does not reorder its input', (): void => {
  const input = { bravo: [{ delta: 1, charlie: 2 }], alpha: 0 }
  encodeCanonicalJson(input)
  expect(Object.keys(input)).toEqual(['bravo', 'alpha'])
  expect(Object.keys(input.bravo[0] ?? {})).toEqual(['delta', 'charlie'])
})

test('only the Node host modules import node:', (): void => {
  const dir = new URL('./', import.meta.url)
  const hosts = readdirSync(dir)
    .filter((file: string): boolean => file.endsWith('.ts'))
    .filter((file: string): boolean => !file.endsWith('.test.ts'))
    .filter((file: string): boolean =>
      readFileSync(new URL(file, dir), 'utf8').includes("from 'node:"),
    )
  expect(hosts.toSorted()).toEqual(['immutable.ts', 'shardfile-stream-node.ts'])
  const lib = readFileSync(new URL('tsconfig.lib.json', dir), 'utf8')
  expect(lib).toContain('"shardfile-stream-node.ts", "immutable.ts"')
})

test('parseShardfileField admits one field with its defining schema', (): void => {
  expect(parseShardfileField('version', SHARDFILE_VERSION)).toBe(
    SHARDFILE_VERSION,
  )
  expect((): unknown => parseShardfileField('version', -1)).toThrow()
  expect(parseShardfileField('migrations', [])).toEqual([])
})
