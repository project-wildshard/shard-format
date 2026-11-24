import { createHash } from 'node:crypto'
import type { Dirent } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { migrateShardfile } from '../format/format-migrate.ts'
import { prepareAssetDecoders } from '../format/shardfile-assets.ts'
import { sourceCounts } from './one-way-counts.ts'
import { enginePins, pinnedProducts } from './one-way-pins.ts'
import { productCounts, productFacts } from './one-way-products.ts'
import { revisionFiles, workingFiles } from './one-way-source.ts'

import type { ProductPin } from './one-way-pins.ts'
import type { ProductFacts } from './one-way-products.ts'
import type { SourceFile } from './one-way-source.ts'

interface InventoryInputs {
  readonly engineRoot: string
  readonly engineRevision: string
  readonly sdkRoot: string
  readonly sdkRevision: string
  readonly formatRoot: string
  /** The recorded product slugs; every engine pin when absent. */
  readonly audited?: readonly string[]
}
interface CorpusIdentity {
  readonly root: string
  readonly sha256: string
}
interface Inventory {
  readonly engineRevision: string
  readonly sdkRevision: string
  readonly pins: readonly ProductPin[]
  readonly corpus: readonly CorpusIdentity[]
  readonly counts: Readonly<Record<string, number>>
}
const START = 0

function corpusRoots(files: readonly SourceFile[]): readonly string[] {
  return files
    .filter((file: Readonly<SourceFile>): boolean =>
      /^corpus\/.+\/shard\.json$/u.test(file.path),
    )
    .map((file: Readonly<SourceFile>): string =>
      file.path.slice(START, -'shard.json'.length),
    )
}
function corpusFiles(
  files: readonly SourceFile[],
  root: string,
): readonly SourceFile[] {
  return files
    .filter(
      (file: Readonly<SourceFile>): boolean =>
        file.path.startsWith(root) && !file.path.endsWith('/validation.json'),
    )
    .map((file: Readonly<SourceFile>): SourceFile => ({
      path: file.path.slice(root.length),
      text: file.text,
    }))
    .toSorted(
      (left: Readonly<SourceFile>, right: Readonly<SourceFile>): number =>
        left.path.localeCompare(right.path),
    )
}
function corpusIdentities(
  files: readonly SourceFile[],
): readonly CorpusIdentity[] {
  return corpusRoots(files).map((root: string): CorpusIdentity => ({
    root,
    sha256: createHash('sha256')
      .update(JSON.stringify(corpusFiles(files, root)))
      .digest('hex'),
  }))
}
function corpusProducts(files: readonly SourceFile[]): readonly ProductFacts[] {
  return corpusRoots(files).map((root: string): ProductFacts =>
    productFacts(root, corpusFiles(files, root)),
  )
}
function sha256(bytes: Readonly<Uint8Array>): string {
  return createHash('sha256').update(bytes).digest('hex')
}
/** Every file of one corpus product on disk, by its path inside the product. */
async function productBytes(root: string): Promise<Map<string, Uint8Array>> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true })
  const rows = await Promise.all(
    entries
      .filter((entry: Readonly<Dirent>): boolean => entry.isFile())
      .map(
        async (
          entry: Readonly<Dirent>,
        ): Promise<readonly [string, Uint8Array]> => {
          const absolute = path.join(entry.parentPath, entry.name)
          return [
            path.relative(root, absolute).split(path.sep).join('/'),
            new Uint8Array(await readFile(absolute)),
          ]
        },
      ),
  )
  return new Map(rows)
}
/**
 * FORMAT-PRUNE FP47c (J505 default): the corpus as the chain serves it. Each corpus product is migrated to the reader's
 * format (the copy the API and cook serve), so a word a chain step mends stops counting; a product the chain cannot
 * admit from the working tree (its blobs are not all committed) counts as stored. The JSON files come back as
 * `SourceFile`s under the product's own root, as `workingFiles` reads them.
 */
async function migratedCorpus(
  formatRoot: string,
  files: readonly SourceFile[],
): Promise<readonly SourceFile[]> {
  await prepareAssetDecoders()
  const groups = await Promise.all(
    corpusRoots(files).map(
      async (root: string): Promise<readonly SourceFile[]> => {
        const stored = files.filter((file: Readonly<SourceFile>): boolean =>
          file.path.startsWith(root),
        )
        try {
          const copy = migrateShardfile(
            await productBytes(path.join(formatRoot, root)),
            { hash: sha256 },
          )
          return [...copy.files.keys()]
            .filter((name: string): boolean => name.endsWith('.json'))
            .map((name: string): SourceFile => ({
              path: `${root}${name}`,
              text: new TextDecoder().decode(copy.files.get(name)),
            }))
        } catch {
          return stored
        }
      },
    ),
  )
  return groups.flat()
}
function corpusCounts(
  files: readonly SourceFile[],
): Readonly<Record<string, number>> {
  const counts = productCounts(corpusProducts(files))
  return Object.fromEntries(
    Object.entries(counts)
      .filter(
        ([name]: readonly [string, number]): boolean =>
          !name.includes('single-shard'),
      )
      .map(
        ([name, count]: readonly [string, number]): readonly [
          string,
          number,
        ] => [name.replace('products.', 'corpus.'), count],
      ),
  )
}

/** Sources are immutable Git blobs; product tarballs must match the same engine pin. */
async function collectInventory(
  input: Readonly<InventoryInputs>,
): Promise<Inventory> {
  const [engine, sdk, format] = await Promise.all([
    revisionFiles(input.engineRoot, input.engineRevision),
    revisionFiles(input.sdkRoot, input.sdkRevision),
    workingFiles(input.formatRoot),
  ])
  const audited =
    input.audited === undefined ? undefined : new Set(input.audited)
  const products = await pinnedProducts(engine, audited)
  return {
    engineRevision: input.engineRevision,
    sdkRevision: input.sdkRevision,
    pins: enginePins(engine, audited),
    corpus: corpusIdentities(format),
    counts: {
      ...sourceCounts({
        engine,
        sdk,
        format,
        kinds: [
          ...new Set(
            products.flatMap(
              (product: Readonly<ProductFacts>): readonly string[] =>
                product.kinds,
            ),
          ),
        ],
      }),
      ...productCounts(products),
      ...corpusCounts(await migratedCorpus(input.formatRoot, format)),
    },
  }
}

export { collectInventory, corpusCounts, corpusIdentities, migratedCorpus }
export type { Inventory, InventoryInputs }
