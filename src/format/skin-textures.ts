// Validator output rows retain the format's mutable public data types.
/* oxlint-disable typescript/prefer-readonly-parameter-types */
import { skinLookParameters } from './skin-file.ts'
/**
 * The textures a shard's skin looks draw (ONE-FORMAT OF27b): each skin, variant and phone skin file's dependencies after
 * its GLB, so a texture sampler row may name them as it names the look's material catalogue textures.
 */
import { SKIN_LOOK_RECIPE } from './skins.ts'

import type { ShardRows } from './rows.ts'
import type { Shardfile } from './shardSchema.ts'

type Source = Readonly<Pick<Shardfile, 'rows' | 'files'>>
type Look = Readonly<ShardRows['looks'][number]>
type Files = ReadonlyMap<string, Readonly<Shardfile['files'][number]>>
/** A skin file's dependencies after its GLB. */
const AFTER_GLB = 1

/** The skin files a skin look names: its skin, its variant table's skins and its phone skin. */
function lookSkinFiles(look: Look, files: Files): readonly string[] {
  if (look.recipe !== SKIN_LOOK_RECIPE) {
    return []
  }
  try {
    const { skin, variants, phone } = skinLookParameters(look)
    const table =
      variants === undefined ? [] : (files.get(variants)?.dependencies ?? [])
    if (phone === undefined) {
      return [skin, ...table]
    }
    const smaller =
      variants === undefined ? [phone] : (files.get(phone)?.dependencies ?? [])
    return [skin, ...table, ...smaller]
  } catch {
    return []
  }
}

/** Every texture a skin look of `source` names, once each. */
function skinLookTextureRefs(source: Source): string[] {
  const files: Files = new Map(
    source.files.map(
      (
        file: Readonly<Shardfile['files'][number]>,
      ): [string, Readonly<Shardfile['files'][number]>] => [file.hash, file],
    ),
  )
  const textures = (hash: string): readonly string[] =>
    files.get(hash)?.dependencies.slice(AFTER_GLB) ?? []
  const refs = source.rows.looks.flatMap((look: Look): readonly string[] =>
    lookSkinFiles(look, files).flatMap((hash: string): readonly string[] =>
      textures(hash),
    ),
  )
  return [...new Set(refs)]
}

export { skinLookTextureRefs }
