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
/** SHARD-COMPAT SP1b1a: the highest spec a `shard.json` may name. A spec above `PREPARATION_SPEC` is a newer package's:
 * this reader keeps its number and reads none of its lists (`unreadPreparationSpec`). */
const MAX_PREPARATION_SPEC = 255
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

/** SP1b1a: the spec a `shard.json` names above every spec this package reads, or `undefined`. A cook names such a file
 * `stale preparation` with both numbers (`unreadPreparationLine`) instead of refusing its index. */
function unreadPreparationSpec(
  index: Readonly<{ preparation?: unknown }>,
): number | undefined {
  const spec = index.preparation
  return typeof spec === 'number' &&
    Number.isInteger(spec) &&
    spec > PREPARATION_SPEC &&
    spec <= MAX_PREPARATION_SPEC
    ? spec
    : undefined
}
/** SP1b1a: `spec 5, reads 3 and 4`: what a file names beside what this package reads. */
function unreadPreparationLine(spec: number): string {
  return `spec ${String(spec)}, reads ${PREPARATION_SPECS.join(' and ')}`
}

export {
  LEGACY_PREPARATION_SPEC,
  MAX_PREPARATION_SPEC,
  unreadPreparationLine,
  unreadPreparationSpec,
  PREPARATION_SPEC,
  PREPARATION_SPECS,
  PREPARED_SDK,
  type PreparationSpec,
  isPreparationSpec,
  preparationSpecOf,
}
