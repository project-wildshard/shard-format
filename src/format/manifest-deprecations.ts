/** ONE-FORMAT OF9b5 under J486: the level manifest's moved words. SDK 0.4.25 builds write none of them (OF9b3b moved
 * the page-start words to their sections, OF9b4 the herd fields to declared rows), but every product built before it
 * still carries some in `ui/level`. FE7 counts each one's kept users. FORMAT-PRUNE FP34 deletes them from
 * `ManifestMetadataSchema` at format 0.1.0.5, and its chain step (`fp34-manifest-moved-words`) lifts the start words into
 * their sections and drops the rest: the herd fields became declared rows in the build, which a copy can't redo. */

import { OLD_POINTER } from './format-migration-prune.ts'
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

/** FORMAT-PRUNE FP47b: each level look word the manifest carried before OF9b2, and the chain step that lifts it. */
const LEVEL_DEPRECATIONS: readonly ManifestDeprecation[] = [
  'sky',
  'atmosphere',
  'grade',
  'horizon',
].map(
  (word: string): ManifestDeprecation => ({
    id: `manifest.${word}`,
    path: `sections/ui/level manifest.${word} (and the discovery mount; ONE-FORMAT OF9b2)`,
    since: '0.1.0.4',
    replacement: `look/look's level.${word} (OF9b2)`,
    migration: 'fp47b-level-look',
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
// The old pointer's spelling is FP8's chain step's (format's one-way `format.grid-pointer-references` counts each one).
const GONE_WORDS: readonly string[] = [
  OLD_POINTER,
  ...MOVED.map(([word]: readonly [string, string]): string => word),
]

/** FORMAT-PRUNE FP47b: the first format whose level manifest and discovery data carry no level look (OF9b2 moved it
 * to `look/look`'s `level`), and the four words. */
const NO_LEVEL_WORDS = '0.1.0.6'
const LEVEL_WORDS: readonly string[] = ['sky', 'atmosphere', 'grade', 'horizon']
/** FORMAT-PRUNE FP36: the discovery mount, which repeats the level manifest as its `data`. */
const DISCOVERY_MOUNT =
  /^mounts\/shardfiles\/(?:_[a-z]+|[a-z][a-z0-9-]*)\/discovery\.json$/u

/** Whether a format version is one that carries none of the gone words. */
function gated(version: unknown): version is string {
  return (
    typeof version === 'string' &&
    compareShardfileVersions(version, NO_MOVED_WORDS) >= NONE
  )
}

/** The gone words a manifest-shaped object still carries at `version`: the moved words from 0.1.0.5, the level look's
 * from 0.1.0.6 (FP47b). */
function keptWords(version: string, manifest: unknown): readonly string[] {
  if (typeof manifest !== 'object' || manifest === null) {
    return []
  }
  const gone =
    compareShardfileVersions(version, NO_LEVEL_WORDS) >= NONE
      ? [...GONE_WORDS, ...LEVEL_WORDS]
      : GONE_WORDS
  return gone.filter((word: string): boolean => Object.hasOwn(manifest, word))
}

/** The row that refuses the kept words: FP47b when they are all the level look's, else the moved words' row. */
function prune(kept: readonly string[], moved = 'FP36'): string {
  return kept.every((word: string): boolean => LEVEL_WORDS.includes(word))
    ? 'FP47b'
    : moved
}
/** Parsed JSON, or nothing for bytes that are none (another check's refusal). */
function jsonOf(bytes: Readonly<Uint8Array>): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return undefined
  }
}

/** Whether a product path is a shard's discovery mount. */
function isDiscoveryMount(path: string): boolean {
  return DISCOVERY_MOUNT.test(path)
}

/** A mount or pack the stream validator checks as it passes and does not hold; the discovery mount it holds (FP36). */
function unheldMount(path: string): boolean {
  return (
    path.startsWith('packs/') ||
    (path.startsWith('mounts/') && !isDiscoveryMount(path))
  )
}

/** FORMAT-PRUNE FP36 (the FP33 pattern): format 0.1.0.5 on refuses a discovery mount whose `data` carries a moved word or
 * the old pointer; an older file keeps them as written, and the chain step (`fp36-discovery-moved-words`) lifts them.
 * Bytes that are no JSON object are another check's refusal. Answers the bytes it checked. */
function checkDiscoveryMount(
  version: unknown,
  path: string,
  bytes: Readonly<Uint8Array>,
): Readonly<Uint8Array> {
  if (!isDiscoveryMount(path) || !gated(version)) {
    return bytes
  }
  const parsed = jsonOf(bytes)
  const data: unknown =
    typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? Reflect.get(parsed, 'data')
      : undefined
  const kept = keptWords(version, data)
  if (kept.length > NONE) {
    throw new Error(
      `Format ${version} carries no ${kept.map((word: string): string => `data.${word}`).join(', ')} (${path}; FORMAT-PRUNE ${prune(kept)})`,
    )
  }
  return bytes
}

/** FORMAT-PRUNE FP34 (the FP33 pattern): format 0.1.0.5 on refuses a level manifest carrying a moved word or the old
 * pointer; an older file keeps them as written, so its source hash still matches, and the chain step
 * (`fp34-manifest-moved-words`) lifts them. */
function checkNoMovedWords(version: unknown, level: unknown): void {
  if (!gated(version)) {
    return
  }
  const kept = keptWords(version, manifestOf(new Map([['ui/level', level]])))
  if (kept.length > NONE) {
    throw new Error(
      `Format ${version} carries no ${kept.map((word: string): string => `manifest.${word}`).join(', ')} (sections/ui/level; FORMAT-PRUNE ${prune(kept, 'FP34')})`,
    )
  }
}

export {
  GONE_WORDS,
  LEVEL_DEPRECATIONS,
  LEVEL_WORDS,
  MANIFEST_MOVED_DEPRECATIONS,
  NO_LEVEL_WORDS,
  NO_MOVED_WORDS,
  checkDiscoveryMount,
  checkNoMovedWords,
  isDiscoveryMount,
  unheldMount,
}
