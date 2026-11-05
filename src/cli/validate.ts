import { createHash } from 'node:crypto'
import {
  closeSync,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  readdirSync,
} from 'node:fs'
import path from 'node:path'

import { prepareAssetDecoders } from '../format/product.ts'
import { validateShardfileProduct } from '../format/productValidation.ts'

import type { ProductFiles } from '../format/productValidation.ts'

// `shardfile validate <dir>`: format validation of a built product folder
// (P1 F3 (a)): schema, inventory, hashes, sizes, costs, budgets and
// admission rows. It never runs script bytes; that is the execution proof
// in sharddev and the cook worker.
//
// Format's ProductFiles port is synchronous, so the reads here are too.
// A read is bounded by the size the index declares, and an unlisted file
// is refused without being read.

interface ProductSummary {
  readonly slug: string
  readonly revision: number
  readonly sections: number
  readonly assets: number
  readonly sourceHash: string
}

const START = 0

function sha256(bytes: Readonly<Uint8Array>): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** Refuses a path that passes through a symlink or is not a regular file. */
function regularFile(root: string, file: string): string {
  let target = root
  for (const part of file.split('/')) {
    target = path.resolve(target, part)
    // oxlint-disable-next-line node/no-sync -- ProductFiles.read is synchronous
    if (lstatSync(target).isSymbolicLink()) {
      throw new Error(`symlinks are refused: ${file}`)
    }
  }
  // oxlint-disable-next-line node/no-sync -- ProductFiles.read is synchronous
  if (!lstatSync(target).isFile()) {
    throw new Error(`not a regular file: ${file}`)
  }
  return target
}

function boundedRead(file: string, maxBytes: number): Uint8Array {
  // oxlint-disable-next-line node/no-sync -- ProductFiles.read is synchronous
  const fd = openSync(file, 'r')
  try {
    // oxlint-disable-next-line node/no-sync -- ProductFiles.read is synchronous
    const { size } = fstatSync(fd)
    if (size > maxBytes) {
      throw new Error(`larger than its declared size: ${file}`)
    }
    const bytes = new Uint8Array(size)
    // oxlint-disable-next-line node/no-sync -- ProductFiles.read is synchronous
    readSync(fd, bytes, START, size, START)
    return bytes
  } finally {
    // oxlint-disable-next-line node/no-sync -- ProductFiles.read is synchronous
    closeSync(fd)
  }
}

/** Every non-directory entry, symlinks included, as `/`-separated paths. */
function productPaths(root: string): string[] {
  // oxlint-disable-next-line node/no-sync -- ProductFiles.paths is synchronous
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

function productFiles(root: string): ProductFiles {
  return {
    read: (file: string, maxBytes: number): Uint8Array =>
      boundedRead(regularFile(root, file), maxBytes),
    paths: (): Iterable<string> => productPaths(root),
  }
}

/** Validates the built product folder at `dir` with format alone. */
async function validateProduct(dir: string): Promise<ProductSummary> {
  await prepareAssetDecoders()
  const valid = validateShardfileProduct(productFiles(path.resolve(dir)), {
    hash: sha256,
  })
  return {
    slug: valid.shard.identity.slug,
    revision: valid.shard.identity.revision,
    sections: valid.sections.size,
    assets: valid.assets.size,
    sourceHash: valid.index.build.sourceHash,
  }
}

/** One line for a product that passed. */
function summary(product: ProductSummary): string {
  const counts = `${String(product.sections)} sections, ${String(product.assets)} assets`
  return `ok ${product.slug} r${String(product.revision)}: ${counts}, source ${product.sourceHash}`
}

export type { ProductSummary }
export { summary, validateProduct }
