/** The corpus judges an older original through the migration chain (J486, SHARD-COMPAT CP1): a file the current
 * format refuses as stored still counts as valid when the chain's copy validates, with the author's own preparation
 * when the steps leave it sealed. */
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { brotliDecompress } from 'node:zlib'

import { migrateShardfile, validateMigrated } from '../format/format-migrate.ts'
import { prepareAssetDecoders } from '../format/shardfile-assets.ts'
import { readTar } from '../format/tar.ts'

/** What the chain did to a refused original whose copy validates. */
interface MigratedVerdict {
  readonly applied: readonly string[]
  readonly deprecations: readonly string[]
}

const NONE = 0
const unbrotli = promisify(brotliDecompress)

function sha256(bytes: Readonly<Uint8Array>): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** The chain's copy of an original tarball, or `undefined` when it cannot be read or the chain cannot run on it. */
function tryChain(
  tar: Readonly<Uint8Array>,
): ReturnType<typeof migrateShardfile> | undefined {
  try {
    return migrateShardfile(readTar(tar), { hash: sha256 })
  } catch {
    return undefined
  }
}

/** The chain's copy of an original, or the stored refusal when the chain cannot run or changes nothing. */
function chainCopy(
  tar: Readonly<Uint8Array>,
  refused: unknown,
): ReturnType<typeof migrateShardfile> {
  const copy = tryChain(tar)
  if (copy === undefined || copy.applied.length === NONE) {
    throw refused
  }
  return copy
}

/** Migrate one stored original (brotli unless `plain`) and validate the copy. Throws the copy's refusal; when the chain cannot
 * run or changes nothing, the stored refusal (`refused`). */
async function migratedVerdict(
  file: string,
  plain: boolean,
  refused: unknown,
): Promise<MigratedVerdict> {
  const stored = new Uint8Array(await readFile(file))
  const tar = plain ? stored : new Uint8Array(await unbrotli(stored))
  const copy = chainCopy(tar, refused)
  await prepareAssetDecoders()
  const validated = validateMigrated(copy.files, {
    hash: sha256,
    judged: 'stored',
    preparation: copy.preparation === 'stale' ? 'migrated' : 'author',
  })
  return { applied: copy.applied, deprecations: validated.deprecations }
}

export { type MigratedVerdict, migratedVerdict }
