import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  assembleOutputShardfile,
  parseOutputIndex,
} from '../format/outputIndex.ts'
import { packFromMembers } from '../format/product-reads.ts'
import { receiptCost } from '../format/receipt-cost.ts'
import { writeTar } from '../format/tar.ts'
import { validationSourceBytes } from '../format/validationReceipt.ts'
import { productFiles, validateInMemory } from './validate.ts'

// `shardfile pack <dir>`: a folder a person holds becomes a tarball, with
// format alone (J168). An author edits a section and packs: what the sections
// measure (hashes, sizes, packs, the source hash) follows here, and a section
// may be written in any JSON layout, since this writes it canonical. Blobs are
// baked files named by their hash, so changing one is the baker's job and the
// validator refuses a stale row. Packs repeat their members, so a tarball
// leaves them out (C0). Nothing is written unless the validator passes. A
// receipt's figures (memory, worst cost, post cost, grid evidence) are
// measured again from the product the validator admitted, never kept.

interface PackOutcome {
  readonly file: string
  readonly hash: string
  readonly bytes: number
  readonly slug: string
}

interface Listed {
  readonly hash: string
  readonly path: string
}

interface Section extends Listed {
  readonly name: string
  readonly bytes: number
}

interface PackMember {
  readonly hash: string
  readonly bytes: number
}

interface PackEntry extends PackMember {
  readonly offset: number
}

interface PackRow extends Listed {
  readonly bytes: number
  readonly entries: readonly PackEntry[]
}

/** The rows of `shard.json` this reads; the rest passes through. */
interface HeldIndex {
  readonly build: Readonly<{ sourceHash: string }>
  readonly files: readonly Listed[]
  readonly packs?: readonly PackRow[] | undefined
  readonly schemas: readonly Listed[]
  readonly sections: readonly Section[]
}

/** What rebuilding a pack reads. */
interface Packing {
  readonly index: HeldIndex
  readonly files: Files
  /** Rows that left a hash, by the hash they left. */
  readonly moved: ReadonlyMap<string, readonly Section[]>
}

type Files = ReadonlyMap<string, Readonly<Uint8Array>>

const INDEX = 'shard.json'
const RECEIPT = 'validation.json'
const PACKS = 'blobs/pack/'
const ANY_SIZE = Number.MAX_SAFE_INTEGER
const START = 0

const decoder = new TextDecoder('utf-8', { fatal: true })
const encoder = new TextEncoder()

function sha256(bytes: Readonly<Uint8Array>): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function held(files: Files, file: string): Uint8Array {
  const bytes = files.get(file)
  if (bytes === undefined) {
    throw new Error(`missing file: ${file}`)
  }
  return bytes
}

function jsonOf(bytes: Readonly<Uint8Array>): unknown {
  return JSON.parse(decoder.decode(bytes))
}

function readFolder(dir: string): Files {
  const product = productFiles(dir)
  const kept = [...product.paths()].filter(
    (file: string): boolean => !file.startsWith(PACKS),
  )
  return new Map(
    kept.map((file: string): readonly [string, Uint8Array] => [
      file,
      product.read(file, ANY_SIZE),
    ]),
  )
}

/** The folder, with each section in its canonical bytes. */
function canonicalSections(index: HeldIndex, folder: Files): Files {
  const sections = index.sections.map(
    (row: Section): readonly [string, Uint8Array] => [
      row.path,
      validationSourceBytes(jsonOf(held(folder, row.path))),
    ],
  )
  return new Map([...folder, ...sections])
}

function movedRows(
  before: readonly Section[],
  after: readonly Section[],
): ReadonlyMap<string, readonly Section[]> {
  const moved = new Map<string, readonly Section[]>()
  for (const [at, row] of after.entries()) {
    const old = before.at(at)?.hash
    if (old !== undefined && old !== row.hash) {
      moved.set(old, [...(moved.get(old) ?? []), row])
    }
  }
  return moved
}

/** A pack's members after an edit. A twin may still hold the old bytes. */
function members(pack: PackRow, packing: Packing): readonly PackMember[] {
  const listed = new Set(
    packing.index.sections.map((row: Section): string => row.hash),
  )
  return pack.entries.flatMap((entry: PackEntry): readonly PackMember[] => {
    const rows = packing.moved.get(entry.hash)
    if (rows === undefined) {
      return [entry]
    }
    return listed.has(entry.hash) ? [entry, ...rows] : rows
  })
}

function placed(rows: readonly PackMember[]): readonly PackEntry[] {
  let offset = START
  return rows.map(({ hash, bytes }: PackMember): PackEntry => {
    const entry = { hash, offset, bytes }
    offset += bytes
    return entry
  })
}

/** A pack again from its members, wherever they now sit. */
function repack(pack: PackRow, packing: Packing): PackRow {
  const entries = placed(members(pack, packing))
  const bytes = entries.reduce(
    (sum: number, entry: PackEntry): number => sum + entry.bytes,
    START,
  )
  const body = packFromMembers(
    { ...pack, entries, bytes },
    packing.index,
    (file: string): Uint8Array => held(packing.files, file),
  )
  const hash = sha256(body)
  const file = pack.path.replace(pack.hash, hash)
  return { ...pack, path: file, hash, bytes, entries }
}

/** The index with every measured row true, the source hash aside. */
function measured(index: HeldIndex, files: Files): HeldIndex {
  const sections = index.sections.map((row: Section): Section => {
    const bytes = held(files, row.path)
    return { ...row, hash: sha256(bytes), bytes: bytes.length }
  })
  const settled = { ...index, sections }
  const moved = movedRows(index.sections, sections)
  const packing = { index: settled, files, moved }
  const packs = index.packs?.map((pack: PackRow): PackRow =>
    repack(pack, packing),
  )
  return packs === undefined ? settled : { ...settled, packs }
}

function sourceHash(index: HeldIndex, files: Files): string {
  const payloads = new Map(
    index.sections.map((row: Section): readonly [string, unknown] => [
      row.name,
      jsonOf(held(files, row.path)),
    ]),
  )
  return sha256(validationSourceBytes(assembleOutputShardfile(index, payloads)))
}

/** The index's bytes, and the receipt that names them. */
function sealed(
  index: HeldIndex,
  files: Files,
): readonly (readonly [string, Uint8Array])[] {
  const source = sourceHash(index, files)
  const build = { ...index.build, sourceHash: source }
  const bytes = validationSourceBytes({ ...index, build })
  const receipt = files.get(RECEIPT)
  if (receipt === undefined) {
    return [[INDEX, bytes]]
  }
  // Evidence, never authority: it says which index it came with.
  const stored = jsonOf(receipt)
  const kept = typeof stored === 'object' ? stored : {}
  const fields = { ...kept, sourceHash: source, indexHash: sha256(bytes) }
  return [
    [INDEX, bytes],
    [RECEIPT, encoder.encode(`${JSON.stringify(fields)}\n`)],
  ]
}

/** The files as a tarball holds them, every measured field true. */
function settle(folder: Files): Files {
  const index: HeldIndex = parseOutputIndex(jsonOf(held(folder, INDEX)))
  const files = canonicalSections(index, folder)
  return new Map([...files, ...sealed(measured(index, files), files)])
}

/** The receipt, if there is one, with `cost`'s figures in place of its own. */
function costed(files: Files, cost: () => object): Files {
  const receipt = files.get(RECEIPT)
  if (receipt === undefined) {
    return files
  }
  const stored = jsonOf(receipt)
  const kept = typeof stored === 'object' ? stored : {}
  const fields = { ...kept, ...cost() }
  return new Map([...files, [RECEIPT, validationSourceBytes(fields)]])
}

/** Packs the folder at `dir` and writes `out`, or `<slug>.tar` here if unset. */
async function packFolder(
  dir: string,
  out: string | undefined,
): Promise<PackOutcome> {
  const settled = settle(readFolder(path.resolve(dir)))
  const product = await validateInMemory(settled)
  const files = costed(settled, (): object =>
    receiptCost(product.shard, product.assets),
  )
  const { slug } = product.index.identity
  const file = path.resolve(out ?? `${slug}.tar`)
  const tar = writeTar(files)
  await writeFile(file, tar)
  return { file, hash: sha256(tar), bytes: tar.length, slug }
}

export type { PackOutcome }
export { packFolder }
