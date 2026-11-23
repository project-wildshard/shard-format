// SHARD-COMPAT PR6d (J487): which files of a shard the MMO server reads, a rule over the index alone, so the cook packs
// the server's files and the server opens them without engine code. Moved from engine
// `src/shared/game/shardfile/outputDescriptor.ts` `serverReadsFile`: every bin, json and wasm file, and the one tile
// file the terrain section names by hash.

/** A file row as the index lists it: its kind and content hash. */
export interface ServerReadRow {
  readonly kind: string
  readonly hash: string
}

/** Whether the MMO server reads this file; `terrain` is the terrain section's file reference, if the shard has one. */
export function serverReadsFile(
  file: ServerReadRow,
  terrain?: string,
): boolean {
  return (
    file.kind === 'bin' ||
    file.kind === 'json' ||
    file.kind === 'wasm' ||
    (file.kind === 'tile' && terrain?.endsWith(file.hash) === true)
  )
}
