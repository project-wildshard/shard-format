/** The corpus's deprecation count (SHARD-COMPAT FE7): how many kept originals use each deprecated path, and which. */
import { createReadStream } from 'node:fs'

import { nodeStreamPorts } from '../format/shardfile-stream-node.ts'
import { validateShardfileStream } from '../format/shardfile-stream.ts'
import { migratedVerdict } from './corpus-migrated.ts'

import type { CorpusRow } from './corpus.ts'

/** A valid original's deprecated paths, and the chain steps that made it valid when it was refused as stored. */
interface StoredVerdict {
  readonly deprecations: readonly string[]
  /** `migrated: <steps>` when the chain's copy is what validated. */
  readonly reason?: string
}

/** Validate one stored original (brotli unless `plain`) as the API stored it; one the format refuses is judged again
 * through the migration chain (J486). Throws the copy's refusal when that fails too. */
async function storedDeprecations(
  file: string,
  plain: boolean,
): Promise<StoredVerdict> {
  try {
    const validated = await validateShardfileStream(
      (): AsyncIterable<Uint8Array> => createReadStream(file),
      { ...nodeStreamPorts({ brotli: !plain }), judged: 'stored' },
    )
    return { deprecations: validated.deprecations }
  } catch (error: unknown) {
    const copy = await migratedVerdict(file, plain, error)
    return {
      deprecations: copy.deprecations,
      reason: `migrated: ${copy.applied.join(', ')}`,
    }
  }
}

/** FE7: one line per deprecated path a kept original uses, with how many and which. */
function deprecationLines(
  rows: readonly Pick<CorpusRow, 'slug' | 'revision' | 'deprecations'>[],
): string[] {
  const users = new Map<string, string[]>()
  for (const found of rows) {
    for (const id of found.deprecations) {
      users.set(id, [
        ...(users.get(id) ?? []),
        `${found.slug} r${String(found.revision)}`,
      ])
    }
  }
  return [...users].map(
    ([id, names]: readonly [string, readonly string[]]): string =>
      `deprecated ${id}: ${String(names.length)} kept originals (${names.join(', ')})`,
  )
}

export { type StoredVerdict, deprecationLines, storedDeprecations }
