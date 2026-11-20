/* oxlint-disable typescript/prefer-readonly-parameter-types -- Shard row schemas use mutable fields. */
import { skinTierRoots } from './skin-file.ts'

import type { ShardRows } from './rows.ts'

type Look = ShardRows['looks'][number]
type WalkLook =
  | Look
  | (Omit<Look, 'parameters'> & { readonly parameters: readonly string[] })
type Tier = 'phone' | 'desktop'
const EMPTY = 0
interface Choice {
  readonly looks: readonly WalkLook[]
  readonly used: ReadonlySet<string>
  readonly off: ReadonlySet<string>
}
interface File {
  readonly hash: string
  readonly dependencies: readonly string[]
}

function maskRoots(look: Look, parameters: readonly string[]): WalkLook {
  return { ...look, parameters }
}

/** Mask paired look roots for the dependency walk. The admitted rows are unchanged. */
function pairedSkinLooks(
  rows: readonly Look[] | undefined,
  tier: Tier,
): Choice {
  const used = new Set<string>()
  const off = new Set<string>()
  const other = tier === 'phone' ? 'desktop' : 'phone'
  const looks = (rows ?? []).map((look): WalkLook => {
    if (
      look.parameters['variants'] === undefined ||
      look.parameters['phone'] === undefined
    ) {
      return look
    }
    const on = skinTierRoots(look, tier)
    for (const hash of on) {
      used.add(hash)
    }
    for (const hash of skinTierRoots(look, other)) {
      if (!on.includes(hash)) {
        off.add(hash)
      }
    }
    return maskRoots(look, on)
  })
  return { looks, used, off }
}

function fileClosure(
  roots: Iterable<string>,
  files: ReadonlyMap<string, File>,
): Set<string> {
  const pending = [...roots]
  const seen = new Set<string>()
  for (const hash of pending) {
    if (!seen.has(hash)) {
      seen.add(hash)
      pending.push(...(files.get(hash)?.dependencies ?? []))
    }
  }
  return seen
}

/** Drop only an unselected tier's files without a remaining consumer or critical pin. */
function unusedSkinTier(
  files: readonly File[],
  off: ReadonlySet<string>,
  used: ReadonlySet<string>,
): readonly string[] {
  if (off.size === EMPTY) {
    return []
  }
  const graph = new Map(files.map((file): [string, File] => [file.hash, file]))
  const unselected = fileClosure(off, graph)
  const independent = [...graph.keys()].filter(
    (hash): boolean => !unselected.has(hash),
  )
  const active = fileClosure([...used, ...independent], graph)
  return [...unselected].filter(
    (hash): boolean => graph.has(hash) && !active.has(hash),
  )
}

export { pairedSkinLooks, unusedSkinTier }
