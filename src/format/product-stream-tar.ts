// The streaming half of `indexTar` (API-CLOUDFLARE AC6a): one pass over a
// tarball's chunks with the same refusals, in bounded memory. Each regular
// file is hashed as it streams; the caller says which files it wants whole.

import { BLOCK, padded } from './tar-fields.ts'
import { MAX_ENTRIES, claimFile, claimFolder, newClaims } from './tar-paths.ts'
import { readTarHeader } from './tar.ts'

import type { TarClaims } from './tar-paths.ts'

const START = 0
const NUL = 0
const NEXT = 1
const END_BLOCKS = 2
const DIRECTORY_TYPE = '5'
const EMPTY: Uint8Array = new Uint8Array(START)

/** An incremental SHA-256 (`node:crypto`'s `createHash('sha256')`). */
interface StreamHasher {
  readonly update: (bytes: Readonly<Uint8Array>) => void
  readonly digest: () => string
}

/** One regular file of the tarball: its size and hash, and its bytes when the caller asked for them. */
interface StreamMember {
  readonly size: number
  readonly sha: string
  readonly bytes: Uint8Array | undefined
}

/** What the walk asks of its caller. */
interface WalkPorts {
  readonly hasher: () => StreamHasher
  /** Whether to hand this file over whole; refuse here (throw) a file too large to hold. */
  readonly wants: (path: string, size: number) => boolean
  /** Called once per regular file, in tarball order. */
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a port's own type: the caller keeps the bytes
  readonly member: (path: string, member: StreamMember) => void
}

/** Exact-length reads over a chunk stream. */
interface ChunkReader {
  /** Up to `length` bytes in pieces; fewer only at the end of the stream. */
  readonly pieces: (length: number) => AsyncGenerator<Uint8Array>
  /** `length` bytes joined, or fewer at the end of the stream. */
  readonly read: (length: number) => Promise<Uint8Array>
}

function isZero(bytes: Readonly<Uint8Array>): boolean {
  return bytes.every((byte: number): boolean => byte === NUL)
}

function chunkReader(source: AsyncIterable<Uint8Array>): ChunkReader {
  const chunks = source[Symbol.asyncIterator]()
  let head = EMPTY
  async function fill(): Promise<boolean> {
    while (head.length === START) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- a stream's chunks come one at a time
      const next = await chunks.next()
      if (next.done === true) {
        return false
      }
      head = next.value
    }
    return true
  }
  async function* pieces(length: number): AsyncGenerator<Uint8Array> {
    let left = length
    // oxlint-disable-next-line eslint/no-await-in-loop -- a stream's chunks come one at a time
    while (left > START && (await fill())) {
      const take = Math.min(left, head.length)
      yield head.subarray(START, take)
      head = head.subarray(take)
      left -= take
    }
  }
  async function read(length: number): Promise<Uint8Array> {
    const out = new Uint8Array(length)
    let at = START
    for await (const piece of pieces(length)) {
      out.set(piece, at)
      at += piece.length
    }
    return at === length ? out : out.subarray(START, at)
  }
  return { pieces, read }
}

/** The end-of-archive blocks: at least two, and nothing after them but zeros. */
async function assertEnd(reader: ChunkReader): Promise<number> {
  let rest = BLOCK
  let zero = true
  for await (const piece of reader.pieces(Number.MAX_SAFE_INTEGER)) {
    rest += piece.length
    zero &&= isZero(piece)
  }
  if (rest < END_BLOCKS * BLOCK || !zero) {
    throw new Error('tar: bad end-of-archive blocks')
  }
  return rest
}

/** Copy `size` bytes through `hasher`, and into `bytes` when held; the count copied. */
async function copyMember(
  reader: ChunkReader,
  size: number,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- `bytes` is the copy's destination
  sink: Readonly<{ hasher: StreamHasher; bytes: Uint8Array | undefined }>,
): Promise<number> {
  let at = START
  for await (const piece of reader.pieces(size)) {
    sink.hasher.update(piece)
    sink.bytes?.set(piece, at)
    at += piece.length
  }
  return at
}

/** Stream one regular file through its hash, held whole when wanted; then its zero padding. */
async function readMember(
  reader: ChunkReader,
  entry: Readonly<{ path: string; size: number }>,
  ports: WalkPorts,
): Promise<StreamMember> {
  const hasher = ports.hasher()
  const bytes = ports.wants(entry.path, entry.size)
    ? new Uint8Array(entry.size)
    : undefined
  if ((await copyMember(reader, entry.size, { hasher, bytes })) < entry.size) {
    throw new Error(`tar: truncated entry ${entry.path}`)
  }
  if (!isZero(await reader.read(padded(entry.size) - entry.size))) {
    throw new Error(`tar: non-zero padding after ${entry.path}`)
  }
  return { size: entry.size, sha: hasher.digest(), bytes }
}

/** One header and its file; the bytes it took. */
async function walkEntry(
  reader: ChunkReader,
  block: Readonly<Uint8Array>,
  walk: Readonly<{ ports: WalkPorts; claims: TarClaims }>,
): Promise<number> {
  const entry = readTarHeader(block)
  if (entry.type === DIRECTORY_TYPE) {
    if (entry.size !== START) {
      throw new Error(`tar: directory with a size ${entry.path}`)
    }
    if (entry.path !== '') {
      claimFolder(walk.claims, entry.path)
    }
    return BLOCK
  }
  claimFile(walk.claims, entry.path)
  walk.ports.member(entry.path, await readMember(reader, entry, walk.ports))
  return BLOCK + padded(entry.size)
}

/** The next header block, refusing a tarball that ends without its end blocks. */
async function nextBlock(reader: ChunkReader): Promise<Uint8Array> {
  const block = await reader.read(BLOCK)
  if (block.length < BLOCK) {
    throw new Error('tar: truncated (no end-of-archive blocks)')
  }
  return block
}

/** Walk a tarball once, refusing what `indexTar` refuses; resolves with its byte length. */
async function walkTar(
  tar: AsyncIterable<Uint8Array>,
  ports: WalkPorts,
): Promise<number> {
  const reader = chunkReader(tar)
  const walk = { ports, claims: newClaims() }
  let offset = START
  for (let entries = START; ; entries += NEXT) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- a tarball's headers come in order
    const block = await nextBlock(reader)
    if (isZero(block)) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- the walk's last step, once
      return offset + (await assertEnd(reader))
    }
    if (entries === MAX_ENTRIES) {
      throw new Error(`tar: too many entries, over ${String(MAX_ENTRIES)}`)
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- a tarball's entries come in order
    offset += await walkEntry(reader, block, walk)
  }
}

export type { StreamHasher, StreamMember, WalkPorts }
export { walkTar }
