/** The corpus's deprecation count (SHARD-COMPAT FE7): how many kept originals use each deprecated path, and which. */
import { createReadStream } from 'node:fs'

import { nodeStreamPorts } from '../format/shardfile-stream-node.ts'
import { validateShardfileStream } from '../format/shardfile-stream.ts'

import type { CorpusRow } from './corpus.ts'

/** Validate one stored original (brotli unless `plain`) as the API stored it; the deprecated paths it uses. Throws on a
 * refusal. */
async function storedDeprecations(
  file: string,
  plain: boolean,
): Promise<readonly string[]> {
  const validated = await validateShardfileStream(
    (): AsyncIterable<Uint8Array> => createReadStream(file),
    { ...nodeStreamPorts({ brotli: !plain }), judged: 'stored' },
  )
  return validated.deprecations
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

export { deprecationLines, storedDeprecations }
