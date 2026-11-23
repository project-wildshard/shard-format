/** ONE-FORMAT OF9b5 under J486: the level manifest's moved words. SDK 0.4.25 builds write none of them (OF9b3b moved
 * the page-start words to their sections, OF9b4 the herd fields to declared rows), but every product built before it
 * still carries some in `ui/level`. FE7 counts each one's kept users; OF9b5a deletes the field from
 * `ManifestMetadataSchema` at zero users. No data migration exists: the start words have a lift at the door
 * (`level-start.ts`), and the herd fields became declared rows in the build, which a copy of the file can't redo. */

/** The registry's row shape (`deprecations.ts`). */
interface ManifestDeprecation {
  readonly id: string
  readonly path: string
  readonly since: string
  readonly replacement: string
  readonly migration: undefined
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
    migration: undefined,
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

export { MANIFEST_MOVED_DEPRECATIONS }
