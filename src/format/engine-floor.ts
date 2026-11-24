import { maxLength, pipe, regex, string } from 'valibot'

import type { GenericSchema } from 'valibot'

// FORMAT-PRUNE FP47b (coordinator, 2026-11-24, J505): a product names the lowest engine release that can draw it
// (`requires.engine`, from format 0.1.0.6). The SDK stamps the engine release it builds against; the cook, a pin and a
// grid's admission refuse a product whose floor is above the engine they run, so a product built for a newer engine
// never lands on an older grid. An older engine's format has no such word and refuses the product outright.

const RELEASE = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u
/** A running engine's version: a release, or a release's prerelease or build (`0.1.83-next.839c8ba0`). */
const RUNNING =
  /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:[-+][0-9A-Za-z.-]+)?$/u
const MAX_RELEASE = 32
const SAME = 0

/** An engine release, `X.Y.Z`. */
const EngineReleaseSchema: GenericSchema<string, string> = pipe(
  string(),
  maxLength(MAX_RELEASE),
  regex(RELEASE),
)

/** A version's release numbers; a prerelease of `X.Y.Z` (an engine `next` build) counts as `X.Y.Z`. */
function releaseParts(version: string): readonly number[] | undefined {
  const groups = RUNNING.exec(version)?.groups
  return groups === undefined
    ? undefined
    : [groups['major'], groups['minor'], groups['patch']].map(Number)
}

/** Positive when `left` is the newer release. */
function compareReleases(
  left: readonly number[],
  right: readonly number[],
): number {
  const differs = left.findIndex(
    (part: number, index: number): boolean => part !== right[index],
  )
  return differs < SAME
    ? SAME
    : (left[differs] ?? SAME) - (right[differs] ?? SAME)
}

/**
 * Why an engine running `running` refuses a product whose floor is `required`, or undefined when it may draw it (no
 * floor, or a floor at or below it). An unreadable running version refuses any floor.
 */
function engineFloorRefusal(
  required: string | undefined,
  running: string,
): string | undefined {
  if (required === undefined) {
    return undefined
  }
  const need = releaseParts(required)
  const have = releaseParts(running)
  if (
    need !== undefined &&
    have !== undefined &&
    compareReleases(have, need) >= SAME
  ) {
    return undefined
  }
  return `This shard needs engine ${required} or newer; this engine is ${running} (requires.engine)`
}

export { EngineReleaseSchema, engineFloorRefusal }
