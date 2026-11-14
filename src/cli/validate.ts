import { createHash } from 'node:crypto'
import {
  closeSync,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
} from 'node:fs'
import path from 'node:path'

import { receiptResidencyShortfall } from '../format/receipt-cost.ts'
import { prepareAssetDecoders } from '../format/shardfile-assets.ts'
import { validateShardfileFolder } from '../format/shardfileValidation.ts'
import { readTar } from '../format/tar.ts'

import type {
  ShardfileFiles,
  ValidatedShardfile,
} from '../format/shardfileValidation.ts'

// `shardfile validate <dir|tar>`: format validation of a built product, as a
// folder or as the tarball a host takes (P1 F3 (a)): schema, inventory, hashes, sizes, costs, budgets and
// admission rows. It never runs script bytes; that is the execution proof
// in sharddev and the cook worker.
//
// Format's ShardfileFiles port is synchronous, so the reads here are too.
// A read is bounded by the size the index declares, and an unlisted file
// is refused without being read.

interface ValidationSummary {
  readonly slug: string
  readonly revision: number
  readonly sections: number
  readonly assets: number
  readonly sourceHash: string
  /** Grandfathered script side lines (SERVER-PARITY SS11): admitted, but printed. */
  readonly warnings: readonly string[]
}

const START = 0
const RECEIPT = 'validation.json'
/** A receipt is a few hundred bytes; this only bounds the read. */
const RECEIPT_BYTES = 1_048_576

function sha256(bytes: Readonly<Uint8Array>): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** Refuses a path that passes through a symlink or is not a regular file. */
function regularFile(root: string, file: string): string {
  let target = root
  for (const part of file.split('/')) {
    target = path.resolve(target, part)
    // oxlint-disable-next-line node/no-sync -- ShardfileFiles.read is synchronous
    if (lstatSync(target).isSymbolicLink()) {
      throw new Error(`symlinks are refused: ${file}`)
    }
  }
  // oxlint-disable-next-line node/no-sync -- ShardfileFiles.read is synchronous
  if (!lstatSync(target).isFile()) {
    throw new Error(`not a regular file: ${file}`)
  }
  return target
}

function boundedRead(file: string, maxBytes: number): Uint8Array {
  // oxlint-disable-next-line node/no-sync -- ShardfileFiles.read is synchronous
  const fd = openSync(file, 'r')
  try {
    // oxlint-disable-next-line node/no-sync -- ShardfileFiles.read is synchronous
    const { size } = fstatSync(fd)
    if (size > maxBytes) {
      throw new Error(`larger than its declared size: ${file}`)
    }
    const bytes = new Uint8Array(size)
    // oxlint-disable-next-line node/no-sync -- ShardfileFiles.read is synchronous
    readSync(fd, bytes, START, size, START)
    return bytes
  } finally {
    // oxlint-disable-next-line node/no-sync -- ShardfileFiles.read is synchronous
    closeSync(fd)
  }
}

/** Every non-directory entry, symlinks included, as `/`-separated paths. */
function productPaths(root: string): string[] {
  // oxlint-disable-next-line node/no-sync -- ShardfileFiles.paths is synchronous
  const entries = readdirSync(root, { recursive: true, withFileTypes: true })
  const kept = entries.filter(
    (entry: Readonly<{ isDirectory: () => boolean }>): boolean =>
      !entry.isDirectory(),
  )
  return kept.map(
    (entry: Readonly<{ name: string; parentPath: string }>): string => {
      const absolute = path.join(entry.parentPath, entry.name)
      return path.relative(root, absolute).split(path.sep).join('/')
    },
  )
}

function shardfileFiles(root: string): ShardfileFiles {
  return {
    read: (file: string, maxBytes: number): Uint8Array =>
      boundedRead(regularFile(root, file), maxBytes),
    paths: (): Iterable<string> => productPaths(root),
  }
}

/** A product already in memory: an unpacked tarball, or `pack`'s result. */
function memoryFiles(
  files: ReadonlyMap<string, Readonly<Uint8Array>>,
): ShardfileFiles {
  return {
    read: (file: string, maxBytes: number): Uint8Array => {
      const bytes = files.get(file)
      if (bytes === undefined) {
        throw new Error(`missing file: ${file}`)
      }
      if (bytes.length > maxBytes) {
        throw new Error(`larger than its declared size: ${file}`)
      }
      return bytes
    },
    paths: (): Iterable<string> => files.keys(),
  }
}

/** A product already in memory, validated with format alone. */
async function validateInMemory(
  files: ReadonlyMap<string, Readonly<Uint8Array>>,
): Promise<ValidatedShardfile> {
  await prepareAssetDecoders()
  return validateShardfileFolder(memoryFiles(files), { hash: sha256 })
}

/** The receipt's JSON, or why it can't be read. */
function readReceipt(
  files: ShardfileFiles,
): Readonly<{ receipt: unknown }> | string {
  try {
    const bytes = files.read(RECEIPT, RECEIPT_BYTES)
    return { receipt: JSON.parse(new TextDecoder().decode(bytes)) }
  } catch (error: unknown) {
    return `${RECEIPT} is unreadable: ${String(error)}`
  }
}

/** The receipt's figures, or why they can't be read. A receipt is evidence
 *  the validator never reads, so a bad one warns rather than refuses. */
function receiptWarnings(
  files: ShardfileFiles,
  shortfall: (receipt: unknown) => string | undefined,
): readonly string[] {
  if (![...files.paths()].includes(RECEIPT)) {
    return []
  }
  const read = readReceipt(files)
  if (typeof read === 'string') {
    return [read]
  }
  const found = shortfall(read.receipt)
  return found === undefined ? [] : [found]
}

function targetFiles(target: string): ShardfileFiles {
  // oxlint-disable-next-line node/no-sync -- read before the sync validator
  if (lstatSync(target).isFile()) {
    // oxlint-disable-next-line node/no-sync -- read before the sync validator
    return memoryFiles(readTar(readFileSync(target)))
  }
  return shardfileFiles(target)
}

/** Validates the built product at `target` with format alone. */
async function validateShardfile(target: string): Promise<ValidationSummary> {
  await prepareAssetDecoders()
  const files = targetFiles(path.resolve(target))
  const valid = validateShardfileFolder(files, { hash: sha256 })
  // A memory figure below the product's own files (Brasscap rev 3: 2,930,740
  // over 4,670,827) warns rather than refuses while a pinned product still
  // carries one; `pack` restamps it.
  const receipt = receiptWarnings(
    files,
    (stored: unknown): string | undefined =>
      receiptResidencyShortfall(stored, valid.shard),
  )
  return {
    slug: valid.shard.identity.slug,
    revision: valid.shard.identity.revision,
    sections: valid.sections.size,
    assets: valid.assets.size,
    sourceHash: valid.index.build.sourceHash,
    warnings: [...valid.warnings, ...receipt],
  }
}

/** One line for a product that passed, then one `warning:` line for each of its warnings. */
function summary(product: ValidationSummary): string {
  const counts = `${String(product.sections)} sections, ${String(product.assets)} assets`
  const ok = `ok ${product.slug} r${String(product.revision)}: ${counts}, source ${product.sourceHash}`
  return [
    ok,
    ...product.warnings.map((line: string): string => `warning: ${line}`),
  ].join('\n')
}

export type { ValidationSummary }
export {
  memoryFiles,
  shardfileFiles,
  summary,
  validateInMemory,
  validateShardfile,
}
