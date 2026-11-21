/**
 * The page-start words (ONE-FORMAT OF9b3, J365 (7)): where a page stands its player, what it arms and what it plays.
 * The level manifest carried them (`spawn`, `loadout`, `weapon`, `audio`, `minimap.image`); since OF9b3 each lives in
 * its section and a product's `ui/level` manifest has none of them:
 *
 * - `spawn` is `world/spawn`, the place the server already stands the player. A manifest spawn with no height (a page on
 *   terrain) keeps the section's height.
 * - `loadout` is `combat/items`' `loadout.level`, and `audio` is `audio/audio`'s `level`, each in the manifest's own
 *   shape (`level-start-rows.ts`), byte for byte.
 * - `weapon` (the old crossbow, sword or custom picker) and `minimap.image` have no reader left: `combat/items` arms the
 *   player and `look/map` carries the map image, so a lift drops them.
 *
 * `levelStart` reads the sections first and lifts an older manifest's words at the door; `liftLevelStart` moves them
 * into the sections (a section's own value wins when both are present). Plain data, no three.js.
 */
import type { LevelAudio, LevelLoadout } from './level-start-rows.ts'
import type { ManifestMetadata } from './minimap.ts'

/** The five words a manifest carried before OF9b3. */
type StartField = 'spawn' | 'loadout' | 'weapon' | 'audio'
/** A manifest as the page start reads it: any of the words, or none. */
type StartManifest = Readonly<
  Partial<Pick<ManifestMetadata, StartField>> & {
    readonly minimap?: Readonly<Partial<ManifestMetadata['minimap']>>
  }
>
/** A world spawn: the server's standing place. */
interface StartSpawn {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly yaw: number
}
/** What the page start is read from: the three sections, and an optional manifest. */
interface LevelStartSource {
  readonly spawn: StartSpawn
  readonly audio: { readonly level?: LevelAudio }
  readonly items: { readonly loadout: { readonly level?: LevelLoadout } }
  readonly manifest?: StartManifest
}
/** A page's start: its spawn (no height on terrain), and its loadout and audio when it declares them. */
interface LevelStart {
  readonly spawn: { x: number; y?: number; z: number; yaw: number }
  readonly loadout?: LevelLoadout
  readonly audio?: LevelAudio
}

const START_FIELDS: readonly StartField[] = [
  'spawn',
  'loadout',
  'weapon',
  'audio',
]
/** `world/spawn`'s default, the value a shard that never set one carries. */
const DEFAULT_SPAWN: StartSpawn = Object.freeze({ x: 0, y: 2, z: 0, yaw: 0 })

/** Whether a world spawn is the default one (a shard that never declared `world/spawn`). */
function defaultSpawn(spawn: StartSpawn): boolean {
  return (
    spawn.x === DEFAULT_SPAWN.x &&
    spawn.y === DEFAULT_SPAWN.y &&
    spawn.z === DEFAULT_SPAWN.z &&
    spawn.yaw === DEFAULT_SPAWN.yaw
  )
}

/** Whether a manifest still carries any page-start word (a product built before OF9b3). */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- plain JSON rows the caller owns; nothing here writes them
function manifestCarriesStart(manifest: StartManifest): boolean {
  return (
    START_FIELDS.some((field: StartField): boolean =>
      Object.hasOwn(manifest, field),
    ) ||
    (manifest.minimap !== undefined && Object.hasOwn(manifest.minimap, 'image'))
  )
}

/** The world spawn a manifest spawn stands on: its height when it has one, else the section's. */
function spawnFrom(
  manifest: NonNullable<ManifestMetadata['spawn']>,
  section: StartSpawn,
): StartSpawn {
  return {
    x: manifest.x,
    y: manifest.y ?? section.y,
    z: manifest.z,
    yaw: manifest.yaw,
  }
}

/**
 * A page's start: the manifest's words where an older product still carries them, else its sections'. `terrain` drops
 * the section spawn's height, as a manifest spawn on terrain had none (the page stands the player on the ground there).
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- plain JSON rows the caller owns; nothing here writes them
function levelStart(source: LevelStartSource, terrain: boolean): LevelStart {
  const manifest = source.manifest ?? {}
  const { x, y, z, yaw } = source.spawn
  const spawn = manifest.spawn ?? (terrain ? { x, z, yaw } : { x, y, z, yaw })
  const loadout = source.items.loadout.level ?? manifest.loadout
  const audio = source.audio.level ?? manifest.audio
  return {
    spawn,
    ...(loadout === undefined ? {} : { loadout }),
    ...(audio === undefined ? {} : { audio }),
  }
}

/** A manifest without the page-start words. */
function withoutStart<Manifest extends StartManifest>(
  manifest: Manifest,
): Omit<Manifest, StartField> {
  const {
    spawn: _spawn,
    loadout: _loadout,
    weapon: _weapon,
    audio: _audio,
    ...rest
  } = manifest
  if (rest.minimap === undefined || !Object.hasOwn(rest.minimap, 'image')) {
    return rest
  }
  const { image: _image, ...minimap } = rest.minimap
  return { ...rest, minimap }
}

/**
 * The door for a product built before OF9b3: the manifest's spawn moves into `world/spawn` (when the shard never set
 * one), its loadout into `items.loadout.level` and its audio into `audio.level` (a section's own value wins), and its
 * weapon and map image leave. A source with none of them comes back as it is (the same object).
 */
function liftLevelStart<Source extends LevelStartSource>(source: Source): Source {
  const { manifest } = source
  if (manifest === undefined || !manifestCarriesStart(manifest)) {
    return source
  }
  const spawn =
    manifest.spawn !== undefined && defaultSpawn(source.spawn)
      ? spawnFrom(manifest.spawn, source.spawn)
      : source.spawn
  const loadout = source.items.loadout.level ?? manifest.loadout
  const audio = source.audio.level ?? manifest.audio
  return {
    ...source,
    manifest: withoutStart(manifest),
    spawn,
    items:
      loadout === undefined
        ? source.items
        : { ...source.items, loadout: { ...source.items.loadout, level: loadout } },
    audio: audio === undefined ? source.audio : { ...source.audio, level: audio },
  }
}

/** OF9b3's rule: a page-start word lives in its section or the manifest, never both. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- plain JSON rows the caller owns; nothing here writes them
function levelStartRules(source: LevelStartSource): readonly string[] {
  const { manifest } = source
  if (manifest === undefined) {
    return []
  }
  const rules: string[] = []
  if (source.items.loadout.level !== undefined && manifest.loadout !== undefined) {
    rules.push(
      'items.loadout.level: the loadout lives in combat/items or the manifest, not both',
    )
  }
  if (source.audio.level !== undefined && manifest.audio !== undefined) {
    rules.push('audio.level: the audio lives in audio/audio or the manifest, not both')
  }
  return rules
}

export {
  DEFAULT_SPAWN,
  levelStart,
  levelStartRules,
  liftLevelStart,
  manifestCarriesStart,
}
export type { LevelStart, LevelStartSource, StartManifest, StartSpawn }
