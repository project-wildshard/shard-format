/**
 * `look.level` (ONE-FORMAT OF9b2, J365 (7)): the level's sky rig, atmosphere, engine grade and painted horizon, in the
 * look section beside the rest of the look. OF7 gave `look.light.heightFog` and `look.grade.bloom`; these are the words
 * it left the manifest's: the sun's colour, intensity and place, the hemisphere, the environment and background
 * intensity, the sun's tints on fog, cloud and shafts, the grade's saturation, brightness, contrast, split tones, lift,
 * gain and gamma, and the horizon rings. Each keeps the shape and units it had in the manifest (the same schemas,
 * `ManifestMetadataSchema.entries`), so a value moves byte for byte and a shard looks the same.
 *
 * A product built since OF9b2 carries them here and its `ui/level` manifest has no `sky`, `atmosphere`, `grade` or
 * `horizon`; an older product carries them in its manifest. `levelLook` reads the look first and lifts an older
 * manifest's at the door; `liftLevelLook` moves them into `look.level` (the look's own win when both are present).
 *
 * Plain data and checks, no three.js.
 */
import { exactOptional, strictObject } from 'valibot'

import { ManifestMetadataSchema } from './minimap.ts'

import type { ManifestMetadata } from './minimap.ts'
import type { GenericSchema } from 'valibot'

/** The sky rig: sun, hemisphere, environment and background intensity, the sun's tints, painted dome, planet, HDRI. */
type LookLevelSky = NonNullable<ManifestMetadata['sky']>
/** Distance and height fog and the volumetric light. */
type LookLevelAtmosphere = NonNullable<ManifestMetadata['atmosphere']>
/** The engine grade. */
type LookLevelGrade = NonNullable<ManifestMetadata['grade']>
/** A painted horizon of rings. */
type LookLevelHorizon = NonNullable<ManifestMetadata['horizon']>
/** `look.level`: the sky rig, atmosphere and grade (all three), and a horizon when the level paints one. */
interface LookLevel {
  sky: LookLevelSky
  atmosphere: LookLevelAtmosphere
  grade: LookLevelGrade
  horizon?: LookLevelHorizon
}
type LookLevelInput = LookLevel
/** The four level fields a manifest carried before OF9b2. */
type LevelField = 'sky' | 'atmosphere' | 'grade' | 'horizon'
/** A manifest as the level look reads it: any of the four fields, or none. */
type LevelManifest = Readonly<Partial<Pick<ManifestMetadata, LevelField>>>
/** What the level look is read from: a look with an optional level, and an optional manifest. */
interface LevelLookSource {
  readonly look: { readonly level?: LookLevel }
  readonly manifest?: LevelManifest
}

const LEVEL_FIELDS: readonly LevelField[] = [
  'sky',
  'atmosphere',
  'grade',
  'horizon',
]
const { entries } = ManifestMetadataSchema

/** `look.level`'s schema: the manifest's own sky, atmosphere, grade and horizon schemas. */
const LookLevelSchema: GenericSchema<LookLevelInput, LookLevel> = strictObject({
  sky: entries.sky.wrapped,
  atmosphere: entries.atmosphere.wrapped,
  grade: entries.grade.wrapped,
  horizon: exactOptional(entries.horizon.wrapped),
})

/** Whether a manifest still carries any of the level look's fields (a product built before OF9b2). */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- plain JSON rows the caller owns; nothing here writes them
function manifestCarriesLevel(manifest: LevelManifest): boolean {
  return LEVEL_FIELDS.some((field: LevelField): boolean =>
    Object.hasOwn(manifest, field),
  )
}

/** The level look a manifest carries, when it carries a whole one (sky, atmosphere and grade). */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- plain JSON rows the caller owns; nothing here writes them
function manifestLevel(manifest: LevelManifest): LookLevel | undefined {
  const { sky, atmosphere, grade, horizon } = manifest
  if (sky === undefined || atmosphere === undefined || grade === undefined) {
    return undefined
  }
  return horizon === undefined
    ? { sky, atmosphere, grade }
    : { sky, atmosphere, grade, horizon }
}

/** The level look of a shard: its look's, else (a product built before OF9b2) its manifest's; none for a plain shard. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- plain JSON rows the caller owns; nothing here writes them
function levelLook(source: LevelLookSource): LookLevel | undefined {
  if (source.look.level !== undefined) {
    return source.look.level
  }
  return source.manifest === undefined
    ? undefined
    : manifestLevel(source.manifest)
}

/** A manifest without the four level fields. */
function withoutLevel<Manifest extends LevelManifest>(
  manifest: Manifest,
): Omit<Manifest, LevelField> {
  const {
    sky: _sky,
    atmosphere: _atmosphere,
    grade: _grade,
    horizon: _horizon,
    ...rest
  } = manifest
  return rest
}

/**
 * The door for a product built before OF9b2: its manifest's `sky`, `atmosphere`, `grade` and `horizon` move into
 * `look.level` (unless the look already declares one, which wins) and leave the manifest. A source with neither, or
 * already lifted, comes back as it is (the same object).
 */
function liftLevelLook<Source extends LevelLookSource>(source: Source): Source {
  const { manifest } = source
  if (manifest === undefined || !manifestCarriesLevel(manifest)) {
    return source
  }
  const level = levelLook(source)
  return {
    ...source,
    manifest: withoutLevel(manifest),
    look: level === undefined ? source.look : { ...source.look, level },
  }
}

/** OF9b2's semantic rule: a shard with a manifest has a whole level look, in `look.level` or the manifest, never both. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- plain JSON rows the caller owns; nothing here writes them
function lookLevelRules(source: LevelLookSource): readonly string[] {
  const { manifest } = source
  if (manifest === undefined) {
    return []
  }
  if (source.look.level !== undefined) {
    return manifestCarriesLevel(manifest)
      ? [
          'look.level: the level look lives in look.level or the manifest, not both',
        ]
      : []
  }
  return manifestLevel(manifest) === undefined
    ? [
        'look.level: a level needs its sky, atmosphere and grade (look.level, or a manifest built before OF9b2)',
      ]
    : []
}

export {
  LookLevelSchema,
  levelLook,
  liftLevelLook,
  lookLevelRules,
  manifestCarriesLevel,
}
export type {
  LevelLookSource,
  LevelManifest,
  LookLevel,
  LookLevelAtmosphere,
  LookLevelGrade,
  LookLevelHorizon,
  LookLevelInput,
  LookLevelSky,
}
