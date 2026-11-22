import { execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import type { Dirent } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { arrayBuffer } from 'node:stream/consumers'
import { promisify } from 'node:util'

interface SourceFile {
  readonly path: string
  readonly text: string
}
interface BlobRef {
  readonly path: string
  readonly hash: string
}
// eslint-disable-next-line typescript/strict-void-return -- Node's callback API returns a child; promisify uses its callback.
const git = promisify(execFile)
const MAX_SOURCE_BYTES = 268_435_456
const HASH = /^[a-f0-9]{40}$/u
const FIRST = 0
const NEXT = 1
const SIZE_FIELD = 2
const LINE_FEED = 10

// The format lock (FE1) mirrors every schema as data; it is generated, not
// source, so its names never count toward a one-way ceiling.
const LOCK_FOLDER = 'src/format/lock/'

function sourcePath(name: string): boolean {
  return (
    !name.startsWith(LOCK_FOLDER) &&
    /\.(?:[cm]?[jt]sx?|json|md)$/u.test(name) &&
    (/^(?:src\/|docs\/|packages\/[^/]+\/(?:src|docs)\/)/u.test(name) ||
      /^packages\/[^/]+\/[^/]+\.md$/u.test(name) ||
      /^[^/]+\.md$/u.test(name) ||
      name === 'test/pins/shardfiles.json')
  )
}

function blobRefs(listing: string): readonly BlobRef[] {
  const refs: BlobRef[] = []
  for (const entry of listing.split('\0')) {
    const groups =
      /^100(?:644|755) blob (?<hash>[a-f0-9]{40})\t(?<path>.+)$/u.exec(
        entry,
      )?.groups
    if (
      groups?.['hash'] !== undefined &&
      groups['path'] !== undefined &&
      sourcePath(groups['path'])
    ) {
      refs.push({ hash: groups['hash'], path: groups['path'] })
    }
  }
  return refs
}

class BlobReader {
  private offset = FIRST
  private readonly bytes: Readonly<Buffer>

  public constructor(bytes: Readonly<Buffer>) {
    this.bytes = bytes
  }

  private size(hash: string): number {
    const end = this.bytes.indexOf(LINE_FEED, this.offset)
    const header = this.bytes
      .subarray(this.offset, end)
      .toString('utf8')
      .split(' ')
    const size = Number(header[SIZE_FIELD])
    if (
      end < this.offset ||
      header[FIRST] !== hash ||
      header[NEXT] !== 'blob' ||
      !Number.isSafeInteger(size) ||
      size < FIRST ||
      end + size + NEXT >= this.bytes.length
    ) {
      throw new Error('Pinned source blob framing differs')
    }
    this.offset = end + NEXT
    return size
  }

  public read(hash: string): string {
    const size = this.size(hash)
    const bytes = this.bytes.subarray(this.offset, this.offset + size)
    const digest = createHash('sha1')
      .update(`blob ${String(size)}\0`)
      .update(bytes)
      .digest('hex')
    if (digest !== hash) {
      throw new Error('Pinned source blob hash differs')
    }
    this.offset += size + NEXT
    return bytes.toString('utf8')
  }
}

async function catFiles(
  root: string,
  hashes: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  const child = spawn('git', ['-C', root, 'cat-file', '--batch'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  child.stderr.resume()
  child.stdin.end(`${hashes.join('\n')}\n`)
  const [body, status] = await Promise.all([
    arrayBuffer(child.stdout),
    once(child, 'close'),
  ])
  if (status[FIRST] !== FIRST || body.byteLength > MAX_SOURCE_BYTES) {
    throw new Error('Could not read pinned source blobs')
  }
  const reader = new BlobReader(Buffer.from(body))
  return new Map(
    hashes.map((hash: string): readonly [string, string] => [
      hash,
      reader.read(hash),
    ]),
  )
}

/** Read immutable source blobs in two Git operations, without changing a checkout. */
async function revisionFiles(
  root: string,
  revision: string,
): Promise<readonly SourceFile[]> {
  if (!HASH.test(revision)) {
    throw new Error('A source inventory requires a full commit id')
  }
  const listing = await git(
    'git',
    ['-C', root, 'ls-tree', '-r', '-z', revision],
    { maxBuffer: MAX_SOURCE_BYTES },
  )
  const refs = blobRefs(listing.stdout)
  const contents = await catFiles(root, [
    ...new Set(refs.map((row: Readonly<BlobRef>): string => row.hash)),
  ])
  return refs.map((row: Readonly<BlobRef>): SourceFile => {
    const text = contents.get(row.hash)
    if (text === undefined) {
      throw new Error(`Missing source blob: ${row.path}`)
    }
    return { path: row.path, text }
  })
}

/** Read the format's sources and corpus; binary assets are not text inputs. */
async function workingFiles(root: string): Promise<readonly SourceFile[]> {
  async function walk(relative: string): Promise<readonly SourceFile[]> {
    const entries = await readdir(path.join(root, relative), {
      withFileTypes: true,
    })
    const groups = await Promise.all(
      entries.map(
        async (entry: Readonly<Dirent>): Promise<readonly SourceFile[]> => {
          const name =
            relative === '' ? entry.name : `${relative}/${entry.name}`
          if (
            entry.isDirectory() &&
            (/^(?:src|docs|corpus)(?:\/|$)/u.test(name) ||
              /^packages(?:\/[^/]+(?:\/(?:src|docs)(?:\/.*)?)?)?$/u.test(name))
          ) {
            return await walk(name)
          }
          if (
            entry.isFile() &&
            (sourcePath(name) || /^corpus\/.+\.json$/u.test(name))
          ) {
            return [
              {
                path: name,
                text: await readFile(path.join(root, name), 'utf8'),
              },
            ]
          }
          return []
        },
      ),
    )
    return groups.flat()
  }
  const files = await walk('')
  return files.toSorted(
    (left: Readonly<SourceFile>, right: Readonly<SourceFile>): number =>
      left.path.localeCompare(right.path),
  )
}

/** Locate a sibling checkout through Git's common directory, including worktrees. */
async function siblingRoot(
  root: string,
  sibling: 'engine' | 'sharddev',
): Promise<string> {
  const result = await git('git', ['-C', root, 'rev-parse', '--git-common-dir'])
  return path.resolve(root, result.stdout.trim(), '..', '..', sibling)
}

export { revisionFiles, siblingRoot, workingFiles }
export type { SourceFile }
