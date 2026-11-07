import assert from 'node:assert/strict'
import { test } from 'node:test'

import { indexTar, readTar, writeTar } from '../format/tar.ts'

const BLOCK = 512
const TYPE_AT = 156
const CHECKSUM_AT = 148

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

/** The tarball with its first header's type flag swapped, checksum fixed. */
function retyped(source: Readonly<Uint8Array>, type: string): Uint8Array {
  const bytes = new Uint8Array(source)
  bytes[TYPE_AT] = type.codePointAt(0) ?? 0
  bytes.fill(32, CHECKSUM_AT, CHECKSUM_AT + 8)
  const sum = bytes
    .subarray(0, BLOCK)
    .reduce((total: number, byte: number): number => total + byte, 0)
  bytes.set(utf8(`${sum.toString(8).padStart(6, '0')}\0 `), CHECKSUM_AT)
  return bytes
}

test('round-trips through the strict reader', (): void => {
  const source = files('shard.json', 'sections/ui/card.json', 'blobs/a.bin')
  const read = readTar(writeTar(source))

  assert.deepEqual(
    [...read.keys()],
    ['blobs/a.bin', 'sections/ui/card.json', 'shard.json'],
  )
  for (const [path, bytes] of source) {
    assert.deepEqual(read.get(path), bytes)
  }
})

test('the same files in any order give the same bytes', (): void => {
  const forwards = files('a', 'b/c', 'd')
  const backwards = new Map([...forwards].toReversed())

  assert.deepEqual(writeTar(backwards), writeTar(forwards))
})

test('pads every entry and ends with two zero blocks', (): void => {
  const tarball = writeTar(new Map([['a', new Uint8Array(BLOCK + 1)]]))

  assert.equal(tarball.length, BLOCK + 2 * BLOCK + 2 * BLOCK)
})

test('splits a long path into prefix and name', (): void => {
  const path = `${'p'.repeat(120)}/${'n'.repeat(90)}.json`

  const tarball = writeTar(files(path))

  assert.deepEqual([...readTar(tarball).keys()], [path])
})

test('counts a path in bytes, not characters', (): void => {
  assert.throws((): Uint8Array => writeTar(files('é'.repeat(99))), /too long/u)
})

test('refuses a path ustar cannot hold', (): void => {
  const long = `${'p'.repeat(156)}/${'n'.repeat(101)}`

  assert.throws((): Uint8Array => writeTar(files('n'.repeat(101))), /too long/u)
  assert.throws((): Uint8Array => writeTar(files(long)), /too long/u)
})

test('refuses a path the reader would refuse', (): void => {
  for (const path of [
    '/etc/passwd',
    '../evil',
    'a/../b',
    'a//b',
    'a/',
    './a',
    'a\0b',
  ]) {
    assert.throws((): Uint8Array => writeTar(files(path)), /bad path/u)
  }
})

test('reads an empty archive', (): void => {
  assert.equal(readTar(new Uint8Array(2 * BLOCK)).size, 0)
})

test('refuses truncation and a missing end', (): void => {
  const tarball = writeTar(files('a'))

  for (const blocks of [1, 2]) {
    assert.throws(
      (): unknown => readTar(tarball.subarray(0, blocks * BLOCK)),
      /truncated/u,
    )
  }
})

test('refuses a corrupt header', (): void => {
  const tarball = writeTar(files('a'))
  tarball[0] = 0x62

  assert.throws((): unknown => readTar(tarball), /not a ustar header/u)
})

test('refuses a link', (): void => {
  const link = retyped(writeTar(files('a')), '2')

  assert.throws((): unknown => readTar(link), /unsupported entry type/u)
})

test('indexes by position what readTar reads, past the first block', (): void => {
  const tarball = writeTar(files('a.txt', 'b/c.txt'))
  const reads: number[] = []
  const index = indexTar({
    length: tarball.length,
    read: (offset: number, length: number): Uint8Array => {
      reads.push(length)
      return tarball.subarray(offset, offset + length)
    },
  })
  const held = readTar(tarball)
  assert.deepEqual([...index.keys()], [...held.keys()])
  for (const [path, { offset, size }] of index) {
    assert.deepEqual(tarball.subarray(offset, offset + size), held.get(path))
  }
  assert.ok(reads.every((length: number): boolean => length <= 65_536))
})
