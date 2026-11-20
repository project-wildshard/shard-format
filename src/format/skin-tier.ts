// ONE-FORMAT OF23f: which skin files a device tier leaves out.
import { safeParse } from 'valibot'

import {
  SKIN_LOOK_RECIPE,
  SkinLookParametersSchema,
  skinLookTierRoots,
} from './skins.ts'

/** The look rows tier selection reads: a skin look names each tier's skin files in its parameters. */
type SkinTierLooks = readonly {
  readonly recipe: string
  readonly parameters: unknown
}[]
interface SkinTierSource {
  readonly files: readonly {
    readonly hash: string
    readonly dependencies: readonly string[]
  }[]
  readonly rows?: { readonly looks: SkinTierLooks }
}
type Tier = 'phone' | 'desktop'
const NONE = 0

function closure(
  dependencies: ReadonlyMap<string, readonly string[]>,
  roots: readonly string[],
): Set<string> {
  const seen = new Set<string>()
  const pending = [...roots]
  for (let hash = pending.pop(); hash !== undefined; hash = pending.pop()) {
    if (!seen.has(hash)) {
      seen.add(hash)
      pending.push(...(dependencies.get(hash) ?? []))
    }
  }
  return seen
}

/**
 * A skin look with a phone skin draws one tier's skin files. The other tier's skin files and variant table, and the GLBs
 * and maps only they reach, are that tier's download, even where the look row names them. `looks` are the rows as this
 * tier reads them (a tiered look names only its tier's roots), for the string walk.
 */
function skinTierOff(
  source: SkinTierSource,
  tier: Tier,
): { readonly off: ReadonlySet<string>; readonly looks: SkinTierLooks } {
  const rows = source.rows?.looks ?? []
  const on: string[] = []
  const other: string[] = []
  const looks = rows.map((row): SkinTierLooks[number] => {
    const parsed =
      row.recipe === SKIN_LOOK_RECIPE
        ? safeParse(SkinLookParametersSchema, row.parameters)
        : undefined
    if (parsed?.success !== true) {
      return row
    }
    const roots = skinLookTierRoots(parsed.output, tier)
    on.push(...roots)
    if (parsed.output.phone === undefined) {
      return row
    }
    other.push(
      ...skinLookTierRoots(
        parsed.output,
        tier === 'phone' ? 'desktop' : 'phone',
      ),
    )
    return { ...row, parameters: roots }
  })
  if (other.length === NONE) {
    return { off: new Set(), looks: rows }
  }
  const dependencies = new Map(
    source.files.map((file): [string, readonly string[]] => [
      file.hash,
      file.dependencies,
    ]),
  )
  const kept = closure(dependencies, on)
  const off = [...closure(dependencies, other)].filter(
    (hash): boolean => !kept.has(hash),
  )
  return { off: new Set(off), looks }
}

export { skinTierOff }
export type { SkinTierLooks }
