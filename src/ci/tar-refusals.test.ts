import assert from 'node:assert/strict'
import { test } from 'node:test'

import { readTar, writeTar } from '../format/tar.ts'

// What the test audit got through `readTar` by hand. CI only (J186).

const BLOCK = 512
const TYPE_AT = 156
const CHECKSUM_AT = 148
const SIZE_AT = 124
const MAGIC_AT = 257
// The format's 4,096 listed files, plus the reader's margin.
const MAX_ENTRIES = 4096 + 1024

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

function files(...paths: readonly string[]): ReadonlyMap<string, Uint8Array> {
  return new Map(
    paths.map((path: string): readonly [string, Uint8Array] => [
      path,
      utf8(`bytes of ${path}`),
    ]),
  )
}

interface RawEntry {
  readonly path: string
  readonly type?: string
  readonly body?: Readonly<Uint8Array>
  /** Declared size, when it should differ from the body's length. */
  readonly size?: number
  /** Bytes for the padding after the body. Zeros if left out. */
  readonly pad?: number
}

/** Writes the checksum of a block built by hand. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the block this seals
function sealed(block: Uint8Array): Uint8Array {
  block.fill(32, CHECKSUM_AT, CHECKSUM_AT + 8)
  const sum = block.reduce(
    (total: number, byte: number): number => total + byte,
    0,
  )
  block.set(utf8(`${sum.toString(8).padStart(6, '0')}\0 `), CHECKSUM_AT)
  return block
}

/** One header, by hand: the writer refuses most of what these tests need. */
function rawHeader(entry: RawEntry): Uint8Array {
  const block = new Uint8Array(BLOCK)
  const size = entry.size ?? entry.body?.length ?? 0
  block.set(utf8(entry.path), 0)
  block.set(utf8(`${size.toString(8).padStart(11, '0')}\0`), SIZE_AT)
  block.set(utf8('ustar'), MAGIC_AT)
  block[TYPE_AT] = (entry.type ?? '0').codePointAt(0) ?? 0
  return sealed(block)
}

function rawBody(entry: RawEntry): Uint8Array {
  const body = entry.body ?? new Uint8Array()
  const padded = new Uint8Array(Math.ceil(body.length / BLOCK) * BLOCK)
  padded.fill(entry.pad ?? 0)
  padded.set(body)
  return padded
}

/** A tarball of raw entries, valid ustar in everything but what they say. */
function rawTar(entries: readonly RawEntry[]): Uint8Array {
  const parts = entries.flatMap((entry: RawEntry): Uint8Array[] => [
    rawHeader(entry),
    rawBody(entry),
  ])
  return new Uint8Array(Buffer.concat([...parts, new Uint8Array(2 * BLOCK)]))
}

function pathsOnly(...paths: readonly string[]): readonly RawEntry[] {
  return paths.map((path: string): RawEntry => ({ path, body: utf8(path) }))
}

test('refuses a path the writer refuses, and a backslash or control byte', (): void => {
  for (const path of [
    String.raw`..\..\evil`,
    String.raw`blobs\a.bin`,
    'a\nb',
    'a\u007Fb',
    'a/./b',
    '/etc/passwd',
    'a/../b',
    'a/',
  ]) {
    assert.throws(
      (): unknown => readTar(rawTar(pathsOnly(path))),
      /bad path/u,
      JSON.stringify(path),
    )
  }
})

test('refuses more entries than a shard may hold, directories too', (): void => {
  const atCap = Array.from(
    { length: MAX_ENTRIES },
    (_entry: unknown, index: number): RawEntry => ({ path: `f${index}` }),
  )

  assert.equal(readTar(rawTar(atCap)).size, MAX_ENTRIES)
  assert.throws(
    (): unknown => readTar(rawTar([...atCap, { path: 'over/', type: '5' }])),
    /too many entries/u,
  )
})

test('refuses a path that is both a file and a folder', (): void => {
  for (const paths of [
    ['a', 'a/b'],
    ['a/b', 'a'],
  ]) {
    assert.throws(
      (): unknown => readTar(rawTar(pathsOnly(...paths))),
      /both a file and a folder/u,
      paths.join(' + '),
    )
  }
})

test('refuses twins one case-folding disk would merge', (): void => {
  for (const paths of [
    ['Sh', 'sh'],
    ['caf\u00E9', 'cafe\u0301'],
  ]) {
    assert.throws(
      (): unknown => readTar(rawTar(pathsOnly(...paths))),
      /duplicate entry/u,
      paths.join(' + '),
    )
  }
})

test('refuses a directory with a size', (): void => {
  const sized = rawTar([{ path: 'a/', type: '5', size: BLOCK }])

  assert.throws((): unknown => readTar(sized), /directory with a size/u)
})

test('refuses non-zero padding, or one set of files has many hashes', (): void => {
  const dirty = rawTar([{ path: 'a', body: utf8('x'), pad: 1 }])

  assert.throws((): unknown => readTar(dirty), /padding/u)
})

test('still reads what `tar -C product .` writes', (): void => {
  const tarball = rawTar([
    { path: './', type: '5' },
    { path: './blobs/', type: '5' },
    { path: './blobs/a.bin', body: utf8('a') },
    { path: './shard.json', body: utf8('{}') },
  ])

  assert.deepEqual([...readTar(tarball).keys()], ['blobs/a.bin', 'shard.json'])
})

test('writes nothing it would refuse to read', (): void => {
  assert.throws((): Uint8Array => writeTar(files(String.raw`a\b`)), /bad path/u)
  assert.throws(
    (): Uint8Array => writeTar(files('a', 'a/b')),
    /both a file and a folder/u,
  )
  assert.throws(
    (): Uint8Array => writeTar(files('Sh', 'sh')),
    /duplicate entry/u,
  )
})
