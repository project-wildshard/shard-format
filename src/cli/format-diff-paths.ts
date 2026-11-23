import { MARKS } from './format-diff-normal.ts'

import type { Change } from './format-diff-data.ts'
import type { Row } from './format-diff-normal.ts'

// SHARD-COMPAT FE2: lock paths: their last segment, their subtree, and the
// `rename?` pairing of a removed and an added part with the same subtree.

type Sides = readonly [ReadonlyMap<string, Row>, ReadonlyMap<string, Row>]

const DEPRECATIONS = './deprecations#'
const CHAIN = './format-chain#'
const LAST_MARK = /[.[|{](?=[^.[|{]*$)/u
const NONE = 0
const NEXT = 1

/** A deprecation or chain step row: an id, never renamed. */
function isRegistry(key: string): boolean {
  return key.startsWith(DEPRECATIONS) || key.startsWith(CHAIN)
}

/** The path above a key's last segment, and the mark that starts that segment ('' for an export). */
function lastSegment(key: string): readonly [string, string] {
  const hash = key.indexOf('#')
  const match = LAST_MARK.exec(key.slice(hash + NEXT))
  if (match === null) {
    return [key.slice(NONE, hash), '']
  }
  const at = hash + NEXT + match.index
  return [key.slice(NONE, at), key.charAt(at)]
}

/** A part's subtree, relative to it, as one comparable string. */
function subtree(key: string, rows: ReadonlyMap<string, Row>): string {
  const keys = [...rows.keys()]
    .filter(
      (other: string): boolean =>
        other === key ||
        (other.startsWith(key) && MARKS.has(other.charAt(key.length))),
    )
    .toSorted()
  return JSON.stringify(
    keys.map((other: string): readonly [string, Row | undefined] => [
      other.slice(key.length),
      rows.get(other),
    ]),
  )
}

function bySignature(
  keys: readonly string[],
  rows: ReadonlyMap<string, Row>,
): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const key of keys.filter((name: string): boolean => !isRegistry(name))) {
    const sign = subtree(key, rows)
    out.set(sign, [...(out.get(sign) ?? []), key])
  }
  return out
}

/** The candidate under the same parent as `key`, else the first. */
function closest(key: string, found: readonly string[]): string | undefined {
  const [parent] = lastSegment(key)
  return (
    found.find(
      (other: string): boolean => lastSegment(other)[NONE] === parent,
    ) ?? found.at(NONE)
  )
}

/** Removed and added parts with the same subtree, as `rename?` pairs (same parent first); the rest stay unpaired. */
function renames(
  gone: readonly string[],
  added: readonly string[],
  sides: Sides,
): ReadonlyMap<string, string> {
  const [before, after] = sides
  const candidates = bySignature(added, after)
  const pairs = new Map<string, string>()
  for (const key of gone.filter((name: string): boolean => !isRegistry(name))) {
    const found = candidates.get(subtree(key, before)) ?? []
    const pick = closest(key, found)
    if (pick !== undefined) {
      pairs.set(key, pick)
      found.splice(found.indexOf(pick), NEXT)
    }
  }
  return pairs
}

function renameChange(from: string, to: string): Change {
  const same = lastSegment(from)[NONE] === lastSegment(to)[NONE]
  return {
    path: from,
    kind: 'breaking',
    what: `rename? ${from} -> ${to}`,
    op: same ? 'rename' : 'moveSection',
    rename: { from, to },
  }
}

export { CHAIN, DEPRECATIONS, lastSegment, renameChange, renames }
