/** The preparation spec version (SHARD-COMPAT PR4, J487): one number owned by this package, beside the format
 * version. A prepared file records it in `shard.json` `preparation` (format 0.1.0.3 on) and as `cook.json`'s
 * `version`; it names no engine release. Spec 3 still carries the engine renderer fingerprint and program build;
 * spec 4 drops both. See `docs/preparation.md`. */

/** `cook.json` version 3: the legacy spec, bound to the engine renderer that recorded it. */
const LEGACY_PREPARATION_SPEC = 3
/** The spec a freshly prepared file is made to: no renderer fingerprint, programs with no engine build. */
const PREPARATION_SPEC = 4
/** Every preparation spec version a reader of this package accepts. */
const PREPARATION_SPECS: readonly [
  typeof LEGACY_PREPARATION_SPEC,
  typeof PREPARATION_SPEC,
] = [LEGACY_PREPARATION_SPEC, PREPARATION_SPEC] as const
type PreparationSpec = (typeof PREPARATION_SPECS)[number]
/** The legacy `sdk` marker's prepared value, which always meant spec 3. */
const PREPARED_SDK = '0.3'

/** Whether `version` is a preparation spec this package reads (a prepared `cook.json`). */
function isPreparationSpec(version: unknown): version is PreparationSpec {
  return PREPARATION_SPECS.some(
    (spec: PreparationSpec): boolean => spec === version,
  )
}

/** The preparation spec a `shard.json` records: `preparation` from format 0.1.0.3, the legacy `sdk: '0.3'` marker as
 * spec 3 before it, `undefined` for an unprepared file. */
function preparationSpecOf(
  index: Readonly<{ sdk?: unknown; preparation?: unknown }>,
): PreparationSpec | undefined {
  if (isPreparationSpec(index.preparation)) {
    return index.preparation
  }
  return index.sdk === PREPARED_SDK ? LEGACY_PREPARATION_SPEC : undefined
}

export {
  LEGACY_PREPARATION_SPEC,
  PREPARATION_SPEC,
  PREPARATION_SPECS,
  PREPARED_SDK,
  type PreparationSpec,
  isPreparationSpec,
  preparationSpecOf,
}
