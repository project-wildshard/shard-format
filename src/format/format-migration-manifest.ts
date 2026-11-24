// oxlint-disable typescript/prefer-readonly-parameter-types -- a step edits the shard it is handed, in place
/** FORMAT-PRUNE FP34 (J486; ONE-FORMAT OF9b5a): format 0.1.0.5 takes the moved words out of the level manifest. The
 * page-start words move into their sections as `liftLevelStart` moves them at the door (a section's own value wins):
 * `spawn` into `world/spawn` when the shard never set one, `loadout` into `combat/items`' `loadout.level`, `audio` into
 * `audio/audio`'s `level`. `weapon` has no reader (`combat/items` arms the player) and leaves. The herd fields
 * (`species`, `spawns`, `faunaTuning`) became declared rows in the build (OF9b4), which a copy of the file can't redo, so
 * they leave too: a file that still needs them is rebuilt on SDK 0.4.25 or later. */
import { DEFAULT_SPAWN } from './level-start.ts'
import {
  LEVEL_WORDS,
  NO_LEVEL_WORDS,
  isDiscoveryMount,
} from './manifest-deprecations.ts'

import type { FormatMigration, MigratingShard } from './format-migrations.ts'

type JsonRecord = Record<string, unknown>

const MANIFEST_WORDS_GONE = '0.1.0.5'
const MOVED_WORDS: readonly string[] = [
  'spawn',
  'loadout',
  'audio',
  'weapon',
  'species',
  'spawns',
  'faunaTuning',
]

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `field` of section `name`, when both are objects. */
function sectionField(
  shard: Readonly<MigratingShard>,
  name: string,
  field: string,
): JsonRecord | undefined {
  const section = shard.sections.get(name)
  const value = isRecord(section) ? section[field] : undefined
  return isRecord(value) ? value : undefined
}

/** Whether a world spawn is the default one, a shard that never set `world/spawn`. */
function defaultSpawn(spawn: Readonly<JsonRecord>): boolean {
  return (
    spawn['x'] === DEFAULT_SPAWN.x &&
    spawn['y'] === DEFAULT_SPAWN.y &&
    spawn['z'] === DEFAULT_SPAWN.z &&
    spawn['yaw'] === DEFAULT_SPAWN.yaw
  )
}

/** The manifest's spawn stands the world spawn, keeping the section's height when it has none (a page on terrain). */
function liftSpawn(
  shard: MigratingShard,
  manifest: Readonly<JsonRecord>,
): void {
  const spawn = sectionField(shard, 'world/spawn', 'spawn')
  const from = manifest['spawn']
  if (spawn === undefined || !isRecord(from) || !defaultSpawn(spawn)) {
    return
  }
  // oxlint-disable-next-line eslint/id-length -- world/spawn names its height y
  Object.assign(spawn, { ...from, y: from['y'] ?? spawn['y'] })
}

/** The manifest's loadout and audio fill their sections' empty `level`. */
function liftLevels(
  shard: MigratingShard,
  manifest: Readonly<JsonRecord>,
): void {
  const items = sectionField(shard, 'combat/items', 'items')
  const loadout = isRecord(items) ? items['loadout'] : undefined
  if (
    isRecord(loadout) &&
    loadout['level'] === undefined &&
    manifest['loadout'] !== undefined
  ) {
    loadout['level'] = manifest['loadout']
  }
  const audio = sectionField(shard, 'audio/audio', 'audio')
  if (
    audio !== undefined &&
    audio['level'] === undefined &&
    manifest['audio'] !== undefined
  ) {
    audio['level'] = manifest['audio']
  }
}

/** Lift a manifest-shaped object's start words into their sections, then drop every moved word and the old pointer. */
function liftAndDrop(shard: MigratingShard, manifest: JsonRecord): void {
  liftSpawn(shard, manifest)
  liftLevels(shard, manifest)
  for (const word of [...MOVED_WORDS, 'gridShardfile']) {
    Reflect.deleteProperty(manifest, word)
  }
}

/** FORMAT-PRUNE FP34: the level manifest carries none of the moved words. */
const manifestMovedWords: FormatMigration = {
  id: 'fp34-manifest-moved-words',
  to: MANIFEST_WORDS_GONE,
  touches: 'data',
  affects: [],
  apply: (shard: MigratingShard): void => {
    const manifest = sectionField(shard, 'ui/level', 'manifest')
    if (manifest === undefined) {
      return
    }
    liftAndDrop(shard, manifest)
  },
}

/** FORMAT-PRUNE FP36: the discovery mount's `data` repeats the level manifest; it carries none of the moved words either.
 * Runs after FP34's step, so a section the level manifest already filled keeps its value. */
const discoveryMovedWords: FormatMigration = {
  id: 'fp36-discovery-moved-words',
  to: MANIFEST_WORDS_GONE,
  touches: 'data',
  affects: [],
  apply: (shard: MigratingShard): void => {
    for (const [path, mount] of shard.mounts) {
      const data = isRecord(mount) ? mount['data'] : undefined
      if (isDiscoveryMount(path) && isRecord(data)) {
        liftAndDrop(shard, data)
      }
    }
  },
}

/** FORMAT-PRUNE FP47b: a manifest-shaped object's level look (sky, atmosphere and grade, and a horizon when it paints
 * one) fills `look/look`'s empty `level`, as `liftLevelLook` does at the door; the look's own wins. Then the four words
 * leave the object. A partial look (no sky, atmosphere or grade) has no level to give and only leaves. */
function liftLevelWords(shard: MigratingShard, manifest: JsonRecord): void {
  const look = sectionField(shard, 'look/look', 'look')
  const { sky, atmosphere, grade, horizon } = manifest
  if (
    look !== undefined &&
    look['level'] === undefined &&
    sky !== undefined &&
    atmosphere !== undefined &&
    grade !== undefined
  ) {
    look['level'] =
      horizon === undefined
        ? { sky, atmosphere, grade }
        : { sky, atmosphere, grade, horizon }
  }
  for (const word of LEVEL_WORDS) {
    Reflect.deleteProperty(manifest, word)
  }
}

/** FORMAT-PRUNE FP47b: format 0.1.0.6 takes the level look out of the level manifest and the discovery mount; it lives
 * in `look/look`'s `level` (ONE-FORMAT OF9b2). The level manifest gives first, then each discovery mount. */
const levelLook: FormatMigration = {
  id: 'fp47b-level-look',
  to: NO_LEVEL_WORDS,
  touches: 'data',
  affects: [],
  apply: (shard: MigratingShard): void => {
    const manifest = sectionField(shard, 'ui/level', 'manifest')
    if (manifest !== undefined) {
      liftLevelWords(shard, manifest)
    }
    for (const [path, mount] of shard.mounts) {
      const data = isRecord(mount) ? mount['data'] : undefined
      if (isDiscoveryMount(path) && isRecord(data)) {
        liftLevelWords(shard, data)
      }
    }
  },
}

export { MOVED_WORDS, discoveryMovedWords, levelLook, manifestMovedWords }
