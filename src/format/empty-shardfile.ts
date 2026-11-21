/** The one starting shard file (FORMAT-PRUNE FP11), admitted by the format's own parser, so a new project starts
 * from a file the game accepts. Engine and sharddev `author.ts` re-export it. */
import { ENTRY_WIDTH } from './contentBounds.ts'
import start from './empty-shardfile.json' with { type: 'json' }
import { parseShardfile } from './shardSchema.ts'
import { SHARDFILE_VERSION } from './version.ts'

import type { Shardfile } from './shardSchema.ts'

/** Each starting door is as wide as the format's entry width. */
function widened(
  row: Readonly<{ edge: string; at: readonly number[] }>,
): object {
  return { edge: row.edge, at: row.at, width: ENTRY_WIDTH }
}

/** A valid empty world; add baked content before shipping a playable shard. */
function emptyShardfile(identity: Readonly<Shardfile['identity']>): Shardfile {
  const { edgeSamples, edgeGrey, edgeHeight, requires, entryways, ...rest } =
    start
  const edge = {
    heights: Array.from({ length: edgeSamples }, (): number => edgeHeight),
    colours: Array.from({ length: edgeSamples }, (): number[] => [
      edgeGrey,
      edgeGrey,
      edgeGrey,
    ]),
    roadHeight: edgeHeight,
  }
  return parseShardfile({
    ...rest,
    version: SHARDFILE_VERSION,
    identity,
    requires: { sdk: SHARDFILE_VERSION, ...requires },
    entryways: entryways.map(
      (row: Readonly<{ edge: string; at: readonly number[] }>): object =>
        widened(row),
    ),
    edge: { north: edge, south: edge, east: edge, west: edge },
  })
}

export { emptyShardfile }
