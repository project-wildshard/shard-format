/** The checks `requireCookPreparation` runs on a prepared file (SHARD-COMPAT PR4 and PR5, J487): the preparation
 * marker against `cook.json`'s spec, the fence and the programs mount. */
import {
  isPreparationSpec,
  preparationSpecOf,
  unreadPreparationLine,
  unreadPreparationSpec,
} from './preparation-spec.ts'
import { validationSourceBytes } from './validationReceipt.ts'

import type { AnyPrograms } from './cook-preparation.ts'
import type { OutputIndex } from './outputIndex.ts'

type Frozen<Value> = Value extends object
  ? { readonly [Key in keyof Value]: Frozen<Value[Key]> }
  : Value

/** Shared by admission and the cook. Legacy sdk 0.2 is an explicit migration boundary. */
function fenceValid(
  index: Frozen<OutputIndex>,
  lists: Readonly<{
    fence: readonly string[]
    mounts: readonly Readonly<{ hash: string }>[]
  }>,
  fix: string,
): void {
  const known = new Set<string>()
  for (const file of index.files) {
    known.add(file.hash)
  }
  for (const mount of lists.mounts) {
    known.add(mount.hash)
  }
  for (const row of lists.fence) {
    if (!known.has(row) && !index.requires.commons.includes(row)) {
      throw new Error(`stale fence preparation: run ${fix}`)
    }
  }
}
function programMountValid(
  index: Frozen<OutputIndex>,
  cook: {
    readonly programs?: AnyPrograms
    readonly mounts: readonly Readonly<{ url: string; hash: string }>[]
  },
  digest: (bytes: Readonly<Uint8Array>) => string,
): void {
  const url = `/programs/${index.identity.slug}.json`
  const mount = cook.mounts.find(
    (row: Readonly<{ url: string; hash: string }>): boolean => row.url === url,
  )
  if (
    cook.programs === undefined ||
    mount?.hash !== digest(validationSourceBytes(cook.programs))
  ) {
    throw new Error(
      `stale GLSL program mount: run wildshard prepare <folder> --base <exact-preview-url> (${index.identity.slug})`,
    )
  }
}
function failureOf(run: () => void): string | undefined {
  try {
    run()
    return undefined
  } catch (error: unknown) {
    return error instanceof Error ? error.message : String(error)
  }
}
const MISMATCH = 'mismatch'
/** Why the marker and `cook.json` disagree, or `undefined` when they agree. */
function markerRefusal(
  spec: number | undefined,
  prepared: boolean,
  noMarker: boolean,
): string | undefined {
  if (spec === undefined) {
    return prepared && noMarker
      ? 'cook.json is prepared but shard.json names no preparation spec'
      : undefined
  }
  return prepared ? MISMATCH : 'Missing cook preparation'
}
/** PR4: whether the file is prepared, holding `shard.json`'s spec and `cook.json`'s version to each other. */
function preparationMarked(
  index: Readonly<{ sdk?: unknown; preparation?: unknown }>,
  version: number | undefined,
  fix: string,
): boolean {
  const unread = unreadPreparationSpec(index)
  if (unread !== undefined) {
    throw new Error(
      `shard.json names a newer preparation (${unreadPreparationLine(unread)}): update this reader or run ${fix}`,
    )
  }
  const spec = preparationSpecOf(index)
  const prepared = isPreparationSpec(version)
  const refusal =
    spec !== undefined && version === spec
      ? undefined
      : markerRefusal(spec, prepared, index.sdk === undefined)
  if (refusal !== undefined) {
    throw new Error(
      refusal === MISMATCH
        ? `shard.json names preparation spec ${String(spec)}, cook.json is spec ${String(version)}: run ${fix}`
        : `${refusal}: run ${fix}`,
    )
  }
  return spec !== undefined || prepared
}

export { failureOf, fenceValid, preparationMarked, programMountValid }
