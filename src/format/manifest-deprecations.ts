/** ONE-FORMAT OF9b5 under J486: the level manifest's moved words. SDK 0.4.25 builds write none of them (OF9b3b moved
 * the page-start words to their sections, OF9b4 the herd fields to declared rows), but every product built before it
 * still carries some in `ui/level`. FE7 counts each one's kept users. FORMAT-PRUNE FP34 deletes them from
 * `ManifestMetadataSchema` at format 0.1.0.5, and its chain step (`fp34-manifest-moved-words`) lifts the start words into
 * their sections and drops the rest: the herd fields became declared rows in the build, which a copy can't redo. */

import { compareShardfileVersions } from './version.ts'

/** The registry's row shape (`deprecations.ts`). */
interface ManifestDeprecation {
  readonly id: string
  readonly path: string
  readonly since: string
  readonly replacement: string
  readonly migration: string
  readonly uses: (
    shard: Readonly<{ sections: ReadonlyMap<string, unknown> }>,
  ) => boolean
}

/** Each moved word and where it lives now. */
const MOVED: readonly (readonly [string, string])[] = [
  ['spawn', 'world/spawn (OF9b3)'],
  ['loadout', "combat/items' loadout.level (OF9b3)"],
  ['audio', "audio/audio's level (OF9b3)"],
  ['weapon', 'nothing: combat/items arms the player (OF9b3)'],
  ['species', 'declared species rows, actors/species (OF9b4)'],
  ['spawns', 'declared spawn rows (OF9b4)'],
  ['faunaTuning', "declared species rows' tuning (OF9b4)"],
]

function manifestOf(sections: ReadonlyMap<string, unknown>): unknown {
  const level = sections.get('ui/level')
  return typeof level === 'object' && level !== null && !Array.isArray(level)
    ? Reflect.get(level, 'manifest')
    : undefined
}

const MANIFEST_MOVED_DEPRECATIONS: readonly ManifestDeprecation[] = MOVED.map(
  ([word, replacement]: readonly [string, string]): ManifestDeprecation => ({
    id: `manifest.${word}`,
    path: `sections/ui/level manifest.${word} (ONE-FORMAT OF9b5)`,
    since: '0.1.0.4',
    replacement,
    migration: 'fp34-manifest-moved-words',
    uses: (
      shard: Readonly<{ sections: ReadonlyMap<string, unknown> }>,
    ): boolean => {
      const manifest = manifestOf(shard.sections)
      return (
        typeof manifest === 'object' &&
        manifest !== null &&
        Object.hasOwn(manifest, word)
      )
    },
  }),
)

/** FORMAT-PRUNE FP34: the first format whose level manifest carries none of the moved words, nor the old pointer. */
const NO_MOVED_WORDS = '0.1.0.5'
const NONE = 0
const GONE_WORDS: readonly string[] = [
  'gridShardfile',
  ...MOVED.map(([word]: readonly [string, string]): string => word),
]

/** FORMAT-PRUNE FP34 (the FP33 pattern): format 0.1.0.5 on refuses a level manifest carrying a moved word or the old
 * pointer; an older file keeps them as written, so its source hash still matches, and the chain step
 * (`fp34-manifest-moved-words`) lifts them. */
function checkNoMovedWords(version: unknown, level: unknown): void {
  if (
    typeof version !== 'string' ||
    compareShardfileVersions(version, NO_MOVED_WORDS) < NONE
  ) {
    return
  }
  const manifest = manifestOf(new Map([['ui/level', level]]))
  if (typeof manifest !== 'object' || manifest === null) {
    return
  }
  const kept = GONE_WORDS.filter((word: string): boolean =>
    Object.hasOwn(manifest, word),
  )
  if (kept.length > NONE) {
    throw new Error(
      `Format ${version} carries no ${kept.map((word: string): string => `manifest.${word}`).join(', ')} (sections/ui/level; FORMAT-PRUNE FP34)`,
    )
  }
}

export {
  GONE_WORDS,
  MANIFEST_MOVED_DEPRECATIONS,
  NO_MOVED_WORDS,
  checkNoMovedWords,
}
