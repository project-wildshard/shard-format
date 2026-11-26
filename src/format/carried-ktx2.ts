// SF15 (J525, meta standalone shardfiles): the cook makes every KTX2 from a shardfile's own images, so a shardfile carries
// images only (JPG or PNG, and GLBs holding them): one way, never two. A new upload that carries its own KTX2 (a `ktx2` blob
// or a `.ktx2` file) is refused here. A stored shard file (an engine pin, a stored original, a cook: `judged: 'stored'`)
// is read as it was admitted, so the shards from before this rule still cook until their re-pack.
//
// A file that must stay an image (UI art, pixel art) says so on its cook mount row: `keepImage: true` (`cook-data.ts`).
import type { OutputIndex } from './outputIndex.ts'
import type { Judged } from './policy-verdict.ts'

const KTX2_PATH = /\.ktx2$/iu

/** The first KTX2 a shardfile carries, by its path in the product: a non-commons `ktx2` blob, or any `.ktx2` file. */
function carriedKtx2(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's output type, only read
  index: OutputIndex,
  paths: Iterable<string>,
): string | undefined {
  const commons = new Set<string>()
  for (const row of index.files) {
    if (row.commons === true) {
      commons.add(row.path)
    } else if (row.kind === 'ktx2') {
      return row.path
    }
  }
  for (const path of paths) {
    if (KTX2_PATH.test(path) && !commons.has(path)) {
      return path
    }
  }
  return undefined
}

/** Refuse a new upload that carries its own KTX2; a stored shard file passes. */
function refuseCarriedKtx2(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's output type, only read
  index: OutputIndex,
  paths: Iterable<string>,
  judged: Judged | undefined,
): void {
  if ((judged ?? 'upload') !== 'upload') {
    return
  }
  const path = carriedKtx2(index, paths)
  if (path !== undefined) {
    throw new Error(
      `A shardfile carries images only; the cook makes every KTX2 (J525): ${path}`,
    )
  }
}

export { carriedKtx2, refuseCarriedKtx2 }
