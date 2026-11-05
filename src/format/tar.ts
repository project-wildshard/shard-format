// The shardfile tarball (J3), both ways: POSIX ustar, regular files and
// directories only. `readTar` is strict: anything else (links, devices, pax
// or GNU long-name headers) is refused, as are absolute and `..` paths and
// duplicate entries. `writeTar` writes only what it would accept, and the
// same files always give the same bytes, because a tarball's hash is its
// identity (J60): sorted paths, no directories, no times, no owners.

const BLOCK = 512
const NAME = { at: 0, length: 100 }
const MODE = { at: 100, length: 8 }
const OWNER = { at: 108, length: 8 }
const GROUP = { at: 116, length: 8 }
const SIZE = { at: 124, length: 12 }
const TIME = { at: 136, length: 12 }
const CHECKSUM = { at: 148, length: 8 }
const TYPE_AT = 156
const MAGIC = { at: 257, length: 5 }
const USTAR_VERSION = { at: 263, length: 2 }
const PREFIX = { at: 345, length: 155 }
const OCTAL = 8
const SPACE = 0x20
const NUL = 0
const END_BLOCKS = 2
const START = 0
const NOT_FOUND = -1
const NEXT = 1
const REGULAR_TYPES = new Set(['0', '\0'])
const REGULAR_CODE = 0x30
const DIRECTORY_TYPE = '5'
const DIRECTORY_CODE = 0x35
const ROOT_ENTRIES = new Set(['.', './'])
const FILE_MODE = 0o644
const NO_ID = 0
// Eleven octal digits: the most a ustar size field holds.
const MAX_FILE_BYTES = 8_589_934_591

interface Field {
  readonly at: number
  readonly length: number
}

const decoder = new TextDecoder('utf-8', { fatal: true })
const encoder = new TextEncoder()

function text(block: Readonly<Uint8Array>, field: Field): string {
  const raw = block.subarray(field.at, field.at + field.length)
  const end = raw.indexOf(NUL)
  return decoder.decode(end === NOT_FOUND ? raw : raw.subarray(START, end))
}

function octal(block: Readonly<Uint8Array>, field: Field): number {
  const digits = text(block, field).trim()
  if (!/^[0-7]+$/u.test(digits)) {
    throw new Error('tar: bad octal field')
  }
  return Number.parseInt(digits, OCTAL)
}

function isZero(block: Readonly<Uint8Array>): boolean {
  return block.every((byte: number): boolean => byte === NUL)
}

/** The header's checksum, with its own field counted as spaces. */
function checksum(block: Readonly<Uint8Array>): number {
  const end = CHECKSUM.at + CHECKSUM.length
  return block.reduce(
    (total: number, byte: number, index: number): number =>
      total + (index >= CHECKSUM.at && index < end ? SPACE : byte),
    START,
  )
}

function checksumOk(block: Readonly<Uint8Array>): boolean {
  return checksum(block) === octal(block, CHECKSUM)
}

function badPart(part: string): boolean {
  return part === '..' || part === ''
}

function entryPath(block: Readonly<Uint8Array>): string {
  const prefix = text(block, PREFIX)
  const name = text(block, NAME)
  const full = prefix === '' ? name : `${prefix}/${name}`
  // `tar -C product .` opens with the root itself: a directory, ignored.
  if (block[TYPE_AT] === DIRECTORY_CODE && ROOT_ENTRIES.has(full)) {
    return ''
  }
  const trimmed = full.replace(/^\.\//u, '').replace(/\/$/u, '')
  if (
    trimmed === '' ||
    full.startsWith('/') ||
    trimmed.split('/').some((part: string): boolean => badPart(part))
  ) {
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

function padded(size: number): number {
  return Math.ceil(size / BLOCK) * BLOCK
}

/** Where the next header starts, after reading the entry at `offset`. */
function readEntry(
  bytes: Readonly<Uint8Array>,
  offset: number,
  files: Map<string, Uint8Array>,
): number {
  const entry = header(bytes.subarray(offset, offset + BLOCK))
  const start = offset + BLOCK
  if (start + entry.size > bytes.length) {
    throw new Error(`tar: truncated entry ${entry.path}`)
  }
  if (REGULAR_TYPES.has(entry.type)) {
    if (files.has(entry.path)) {
      throw new Error(`tar: duplicate entry ${entry.path}`)
    }
    // A view, not a copy: a full shard is hundreds of megabytes.
    files.set(entry.path, bytes.subarray(start, start + entry.size))
  }
  return start + padded(entry.size)
}

function assertEnd(bytes: Readonly<Uint8Array>, offset: number): void {
  const rest = bytes.subarray(offset)
  if (rest.length < END_BLOCKS * BLOCK || !isZero(rest)) {
    throw new Error('tar: bad end-of-archive blocks')
  }
}

/** The tarball's regular files by path; throws on anything not strictly ustar. */
function readTar(bytes: Readonly<Uint8Array>): ReadonlyMap<string, Uint8Array> {
  const files = new Map<string, Uint8Array>()
  let offset = START
  for (;;) {
    const block = bytes.subarray(offset, offset + BLOCK)
    if (block.length < BLOCK) {
      throw new Error('tar: truncated (no end-of-archive blocks)')
    }
    if (isZero(block)) {
      assertEnd(bytes, offset)
      return files
    }
    offset = readEntry(bytes, offset, files)
  }
}

function byteLength(value: string): number {
  return encoder.encode(value).length
}

function assertWritablePath(path: string): void {
  if (
    path.startsWith('/') ||
    path.endsWith('/') ||
    path.includes('\0') ||
    path
      .split('/')
      .some((part: string): boolean => badPart(part) || part === '.')
  ) {
    throw new Error(`tar: bad path ${JSON.stringify(path)}`)
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

function octalField(value: number, field: Field): string {
  return `${value.toString(OCTAL).padStart(field.length - NEXT, '0')}\0`
}

/** Every field the writer sets, the checksum aside. */
function headerFields(
  file: Readonly<{ path: string; size: number }>,
): readonly (readonly [Field, string])[] {
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

export { readTar, writeTar }
