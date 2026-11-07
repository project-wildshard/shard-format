// `writeTar`: the same files always give the same bytes, and only what
// `readTar` would accept. Sorted paths, no directories, no times, no owners.

import {
  BLOCK,
  CHECKSUM,
  GROUP,
  MAGIC,
  MODE,
  NAME,
  OWNER,
  PREFIX,
  SIZE,
  TIME,
  TYPE_AT,
  USTAR_VERSION,
  checksum,
  padded,
} from './tar-fields.ts'
import { MAX_ENTRIES, badPath, claimFile, newClaims } from './tar-paths.ts'

import type { TarField } from './tar-fields.ts'

const OCTAL = 8
const END_BLOCKS = 2
const START = 0
const NOT_FOUND = -1
const NEXT = 1
const REGULAR_CODE = 0x30
const FILE_MODE = 0o644
const NO_ID = 0
// Eleven octal digits: the most a ustar size field holds.
const MAX_FILE_BYTES = 8_589_934_591
const encoder = new TextEncoder()

function byteLength(value: string): number {
  return encoder.encode(value).length
}

function assertWritablePath(path: string): void {
  if (badPath(path)) {
    throw new Error(`tar: bad path ${JSON.stringify(path)}`)
  }
}

/** Refuses a set of files the reader would refuse once written. */
function assertWritableSet(
  files: ReadonlyMap<string, Readonly<Uint8Array>>,
): void {
  if (files.size > MAX_ENTRIES) {
    throw new Error(`tar: too many entries, over ${MAX_ENTRIES}`)
  }
  const claims = newClaims()
  for (const path of files.keys()) {
    assertWritablePath(path)
    claimFile(claims, path)
  }
}

/** The path as ustar's name and prefix fields, split at a `/`. */
function splitPath(path: string): readonly [string, string] {
  if (byteLength(path) <= NAME.length) {
    return ['', path]
  }
  for (
    let slash = path.indexOf('/');
    slash !== NOT_FOUND;
    slash = path.indexOf('/', slash + NEXT)
  ) {
    const prefix = path.slice(START, slash)
    const name = path.slice(slash + NEXT)
    if (
      byteLength(prefix) <= PREFIX.length &&
      byteLength(name) <= NAME.length
    ) {
      return [prefix, name]
    }
  }
  throw new Error(`tar: path too long for ustar: ${path}`)
}

function octalField(value: number, field: TarField): string {
  return `${value.toString(OCTAL).padStart(field.length - NEXT, '0')}\0`
}

/** Every field the writer sets, the checksum aside. */
function headerFields(
  file: Readonly<{ path: string; size: number }>,
): readonly (readonly [TarField, string])[] {
  const [prefix, name] = splitPath(file.path)
  return [
    [NAME, name],
    [MODE, octalField(FILE_MODE, MODE)],
    [OWNER, octalField(NO_ID, OWNER)],
    [GROUP, octalField(NO_ID, GROUP)],
    [SIZE, octalField(file.size, SIZE)],
    [TIME, octalField(NO_ID, TIME)],
    [MAGIC, 'ustar'],
    [USTAR_VERSION, '00'],
    [PREFIX, prefix],
  ]
}

function assertWritable(file: Readonly<{ path: string; size: number }>): void {
  assertWritablePath(file.path)
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`tar: file too large for ustar: ${file.path}`)
  }
}

function writeHeader(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the block this writes
  block: Uint8Array,
  file: Readonly<{ path: string; size: number }>,
): void {
  assertWritable(file)
  for (const [field, value] of headerFields(file)) {
    block.set(encoder.encode(value), field.at)
  }
  block[TYPE_AT] = REGULAR_CODE
  const sum = octalField(checksum(block), CHECKSUM)
  block.set(encoder.encode(sum), CHECKSUM.at)
}

function tarLength(files: ReadonlyMap<string, Readonly<Uint8Array>>): number {
  let total = END_BLOCKS * BLOCK
  for (const bytes of files.values()) {
    total += BLOCK + padded(bytes.length)
  }
  return total
}

/** A tarball of `files`: the same files in any order give the same bytes. */
function writeTar(
  files: ReadonlyMap<string, Readonly<Uint8Array>>,
): Uint8Array<ArrayBuffer> {
  assertWritableSet(files)
  const tarball = new Uint8Array(tarLength(files))
  let offset = START
  // This library's target is ES2022, so no `toSorted`; the copy is ours.
  // oxlint-disable-next-line unicorn/no-array-sort -- see above
  for (const path of [...files.keys()].sort()) {
    const bytes = files.get(path) ?? new Uint8Array()
    const size = bytes.length
    writeHeader(tarball.subarray(offset, offset + BLOCK), { path, size })
    tarball.set(bytes, offset + BLOCK)
    offset += BLOCK + padded(size)
  }
  return tarball
}

export { writeTar }
