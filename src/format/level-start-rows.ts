/**
 * ONE-FORMAT OF9b3 (J365 (7)): the shapes of the page-start words the level manifest carried, for the sections they move
 * to. `audio.level` takes the manifest's `audio` and `items.loadout.level` its `loadout`, each with the schema it had in
 * the manifest (`ManifestMetadataSchema.entries`), so a value moves byte for byte. `level-start.ts` reads and lifts them.
 */
import { ManifestMetadataSchema } from './minimap.ts'

import type { ManifestMetadata } from './minimap.ts'
import type { GenericSchema } from 'valibot'

/** The page's ambience and score names, its catalogue flag, its alert rule and sample policy. */
type LevelAudio = NonNullable<ManifestMetadata['audio']>
/** The page's weapons, tools, the ones it starts holding, its held weapon and practice loans. */
type LevelLoadout = NonNullable<ManifestMetadata['loadout']>

const { entries } = ManifestMetadataSchema
const LevelAudioSchema: GenericSchema<LevelAudio, LevelAudio> =
  entries.audio.wrapped
const LevelLoadoutSchema: GenericSchema<LevelLoadout, LevelLoadout> =
  entries.loadout.wrapped

export { LevelAudioSchema, LevelLoadoutSchema }
export type { LevelAudio, LevelLoadout }
