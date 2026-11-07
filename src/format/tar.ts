// The shardfile tarball (J3), both ways: POSIX ustar, regular files and
// directories only. `readTar` is strict: anything else (links, devices, pax
// or GNU long-name headers) is refused, as are absolute, `.` and `..` paths,
// backslashes, control bytes, duplicate entries, a file that is also a folder,
// twins a case-folding disk would merge, non-zero padding and more entries
// than a shard may hold. `writeTar` writes only what it would accept, and the
// same files always give the same bytes, because a tarball's hash is its
// identity (J60): sorted paths, no directories, no times, no owners.

import {
  BLOCK,
  CHECKSUM,
  MAGIC,
  NAME,
  PREFIX,
  SIZE,
  TYPE_AT,
  checksum,
  padded,
} from './tar-fields.ts'
import {
  MAX_ENTRIES,
  badPath,
  claimFile,
  claimFolder,
  newClaims,
} from './tar-paths.ts'

import type { TarField } from './tar-fields.ts'
import type { TarClaims } from './tar-paths.ts'
import type { TarEntry, TarSource } from './tar-source.ts'

const OCTAL = 8
const NUL = 0
const END_BLOCKS = 2
const END_CHUNK = 65_536
const START = 0
const NOT_FOUND = -1
const NEXT = 1
const REGULAR_TYPES = new Set(['0', '\0'])
const DIRECTORY_TYPE = '5'
const DIRECTORY_CODE = 0x35
const ROOT_ENTRIES = new Set(['.', './'])

const decoder = new TextDecoder('utf-8', { fatal: true })

function text(block: Readonly<Uint8Array>, field: TarField): string {
  const raw = block.subarray(field.at, field.at + field.length)
  const end = raw.indexOf(NUL)
  return decoder.decode(end === NOT_FOUND ? raw : raw.subarray(START, end))
}

function octal(block: Readonly<Uint8Array>, field: TarField): number {
  const digits = text(block, field).trim()
  if (!/^[0-7]+$/u.test(digits)) {
    throw new Error('tar: bad octal field')
  }
  return Number.parseInt(digits, OCTAL)
}

function isZero(block: Readonly<Uint8Array>): boolean {
  return block.every((byte: number): boolean => byte === NUL)
}

function checksumOk(block: Readonly<Uint8Array>): boolean {
  return checksum(block) === octal(block, CHECKSUM)
}

function entryPath(block: Readonly<Uint8Array>): string {
  const prefix = text(block, PREFIX)
  const name = text(block, NAME)
  const full = prefix === '' ? name : `${prefix}/${name}`
  // `tar -C product .` opens with the root itself: a directory, ignored.
  if (block[TYPE_AT] === DIRECTORY_CODE && ROOT_ENTRIES.has(full)) {
    return ''
  }
  const relative = full.replace(/^\.\//u, '')
  const trimmed =
    block[TYPE_AT] === DIRECTORY_CODE ? relative.replace(/\/$/u, '') : relative
  if (full.startsWith('/') || trimmed === '' || badPath(trimmed)) {
    throw new Error(`tar: bad path ${JSON.stringify(full)}`)
  }
  return trimmed
}

interface Header {
  readonly path: string
  readonly type: string
  readonly size: number
}

function header(block: Readonly<Uint8Array>): Header {
  if (text(block, MAGIC) !== 'ustar' || !checksumOk(block)) {
    throw new Error('tar: not a ustar header')
  }
  const type = String.fromCodePoint(block[TYPE_AT] ?? NUL)
  if (!REGULAR_TYPES.has(type) && type !== DIRECTORY_TYPE) {
    throw new Error(`tar: unsupported entry type ${JSON.stringify(type)}`)
  }
  return { path: entryPath(block), type, size: octal(block, SIZE) }
}

/** Padding must be zeros: anything else mints a new hash for the same files. */
function assertPadding(source: TarSource, offset: number, path: string): void {
  const length = padded(offset) - offset
  if (length > START && !isZero(source.read(offset, length))) {
    throw new Error(`tar: non-zero padding after ${path}`)
  }
}

interface Reading {
  readonly source: TarSource
  readonly files: Map<string, TarEntry>
  readonly claims: TarClaims
}

function recordEntry(
  entry: Header,
  start: number,
  reading: Readonly<Reading>,
): void {
  if (REGULAR_TYPES.has(entry.type)) {
    claimFile(reading.claims, entry.path)
    reading.files.set(entry.path, { offset: start, size: entry.size })
    assertPadding(reading.source, start + entry.size, entry.path)
  } else if (entry.path !== '') {
    claimFolder(reading.claims, entry.path)
  }
}

/** Where the next header starts, after reading the entry at `offset`. */
function readEntry(offset: number, reading: Readonly<Reading>): number {
  const { source } = reading
  const entry = header(source.read(offset, BLOCK))
  const start = offset + BLOCK
  if (entry.type === DIRECTORY_TYPE && entry.size !== START) {
    throw new Error(`tar: directory with a size ${entry.path}`)
  }
  if (start + entry.size > source.length) {
    throw new Error(`tar: truncated entry ${entry.path}`)
  }
  recordEntry(entry, start, reading)
  return start + padded(entry.size)
}

function assertEnd(source: TarSource, offset: number): void {
  if (source.length - offset < END_BLOCKS * BLOCK) {
    throw new Error('tar: bad end-of-archive blocks')
  }
  for (let at = offset; at < source.length; at += END_CHUNK) {
    if (!isZero(source.read(at, Math.min(END_CHUNK, source.length - at)))) {
      throw new Error('tar: bad end-of-archive blocks')
    }
  }
}

function firstBlock(source: TarSource, offset: number): Readonly<Uint8Array> {
  const block = source.read(offset, BLOCK)
  if (block.length < BLOCK) {
    throw new Error('tar: truncated (no end-of-archive blocks)')
  }
  return block
}

/** Each regular file's place, reading only headers; refuses what `readTar` does. */
function indexTar(source: TarSource): ReadonlyMap<string, TarEntry> {
  const reading = {
    source,
    files: new Map<string, TarEntry>(),
    claims: newClaims(),
  }
  let offset = START
  for (let entries = START; ; entries += NEXT) {
    if (isZero(firstBlock(source, offset))) {
      assertEnd(source, offset)
      return reading.files
    }
    if (entries === MAX_ENTRIES) {
      throw new Error(`tar: too many entries, over ${MAX_ENTRIES}`)
    }
    offset = readEntry(offset, reading)
  }
}

/** The tarball's regular files by path; throws on anything not strictly ustar. */
function readTar(bytes: Readonly<Uint8Array>): ReadonlyMap<string, Uint8Array> {
  const index = indexTar({
    length: bytes.length,
    read: (offset: number, length: number): Readonly<Uint8Array> =>
      bytes.subarray(offset, offset + length),
  })
  const files = new Map<string, Uint8Array>()
  for (const [path, { offset, size }] of index) {
    // A view, not a copy: a full shard is hundreds of megabytes.
    files.set(path, bytes.subarray(offset, offset + size))
  }
  return files
}

export type { TarEntry, TarSource } from './tar-source.ts'
export { writeTar } from './tar-write.ts'
export { indexTar, readTar }
