import { finding } from './format-diff-data.ts'
import { MARKS, normalRows } from './format-diff-normal.ts'
import { changedFindings, OPTIONALS } from './format-diff-rules.ts'

import type {
  Change,
  ChangeKind,
  Finding,
  MigrationOp,
} from './format-diff-data.ts'
import type { LockData } from './format-diff-lock.ts'
import type { Row } from './format-diff-normal.ts'

// SHARD-COMPAT FE2: `shard-format format-diff <a> <b>` classifies each
// change between two format locks (FE1) as additive, deprecation, breaking
// or review, pairs a removed and an added part with the same subtree as
// `rename?`, and suggests an FE8 migration op. Only the topmost added or
// removed path is reported: a new optional object is one change, not one
// per field inside it. Rules per row: format-diff-rules.ts.

interface Report {
  readonly chain:
    | { readonly before: string; readonly after: string }
    | undefined
  readonly changes: readonly Change[]
  readonly worst: ChangeKind | 'none'
}

type Sides = readonly [ReadonlyMap<string, Row>, ReadonlyMap<string, Row>]

const DEPRECATIONS = './deprecations#'
const KINDS: readonly ChangeKind[] = [
  'breaking',
  'review',
  'deprecation',
  'additive',
]
const NONE = 0
const NEXT = 1
const BEFORE = -1
const LAST_MARK = /[.[|{](?=[^.[|{]*$)/u
const REMOVED: Readonly<
  Record<string, readonly [string, MigrationOp | undefined]>
> = {
  '': ['export removed', undefined],
  '.': ['field removed', 'drop'],
  '|': ['union option removed', 'map'],
}

/** Whether some proper prefix of `key`, cut at a mark, is in `set`. */
function covered(key: string, set: ReadonlySet<string>): boolean {
  for (let at = NEXT; at < key.length; at += NEXT) {
    if (MARKS.has(key.charAt(at)) && set.has(key.slice(NONE, at))) {
      return true
    }
  }
  return false
}

function topmost(keys: ReadonlySet<string>): readonly string[] {
  return [...keys]
    .filter((key: string): boolean => !covered(key, keys))
    .toSorted()
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

function fieldFinding(parent: string, row: Row | undefined): Finding {
  if (
    row?.kind === 'schema' &&
    row.wrap.some((type: string): boolean => OPTIONALS.has(type))
  ) {
    return finding('additive', 'new optional field')
  }
  return finding('breaking', `new required field in ${parent}`, 'fill')
}

function addedFinding(key: string, rows: ReadonlyMap<string, Row>): Finding {
  if (key.startsWith(DEPRECATIONS)) {
    return finding(
      'deprecation',
      `deprecates ${key.slice(DEPRECATIONS.length)}`,
    )
  }
  const [parent, mark] = lastSegment(key)
  const plain: Readonly<Record<string, Finding>> = {
    '': finding('additive', 'new export'),
    '|': finding('additive', 'new union option'),
  }
  if (mark === '.') {
    return fieldFinding(parent, rows.get(key))
  }
  const tuple = mark === '[' && !key.endsWith('[]')
  return (
    plain[mark] ??
    (tuple
      ? finding('breaking', 'new tuple item', 'fill')
      : finding('review', 'new part'))
  )
}

function removedFinding(key: string): Finding {
  if (key.startsWith(DEPRECATIONS)) {
    return finding(
      'breaking',
      `deletes deprecated ${key.slice(DEPRECATIONS.length)} (FE13 gate)`,
    )
  }
  const [, mark] = lastSegment(key)
  const [text, op] = REMOVED[mark] ?? ['part removed', undefined]
  return finding('breaking', text, op)
}

function withPath(path: string, found: Finding): Change {
  return { path, ...found }
}

function bySignature(
  keys: readonly string[],
  rows: ReadonlyMap<string, Row>,
): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const key of keys.filter(
    (name: string): boolean => !name.startsWith(DEPRECATIONS),
  )) {
    const sign = subtree(key, rows)
    out.set(sign, [...(out.get(sign) ?? []), key])
  }
  return out
}

/** Removed and added parts with the same subtree, as `rename?` pairs (same parent first); the rest stay unpaired. */
/** The candidate under the same parent as `key`, else the first. */
function closest(key: string, found: readonly string[]): string | undefined {
  const [parent] = lastSegment(key)
  return (
    found.find(
      (other: string): boolean => lastSegment(other)[NONE] === parent,
    ) ?? found.at(NONE)
  )
}

function renames(
  gone: readonly string[],
  added: readonly string[],
  sides: Sides,
): ReadonlyMap<string, string> {
  const [before, after] = sides
  const candidates = bySignature(added, after)
  const pairs = new Map<string, string>()
  for (const key of gone.filter(
    (name: string): boolean => !name.startsWith(DEPRECATIONS),
  )) {
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

/** Rows present on both sides whose facts moved. */
function changedRows(
  before: ReadonlyMap<string, Row>,
  after: ReadonlyMap<string, Row>,
): readonly Change[] {
  return [...after].flatMap(
    ([key, row]: readonly [string, Row]): readonly Change[] => {
      const old = before.get(key)
      if (old === undefined || JSON.stringify(old) === JSON.stringify(row)) {
        return []
      }
      return changedFindings(key, old, row).map((found: Finding): Change =>
        withPath(key, found),
      )
    },
  )
}

/** Exported functions (FE1 excludes them with a reason): a new one adds, a gone one breaks importers. */
function excludedChanges(before: LockData, after: LockData): readonly Change[] {
  const added = Object.keys(after.excluded).filter(
    (key: string): boolean => !(key in before.excluded),
  )
  const gone = Object.keys(before.excluded).filter(
    (key: string): boolean => !(key in after.excluded),
  )
  return [
    ...added.map((key: string): Change =>
      withPath(key, finding('additive', 'new export (not locked: function)')),
    ),
    ...gone.map((key: string): Change =>
      withPath(key, finding('breaking', 'export removed (was a function)')),
    ),
  ]
}

function worstOf(changes: readonly Change[]): ChangeKind | 'none' {
  return (
    KINDS.find((kind: ChangeKind): boolean =>
      changes.some((found: Readonly<Change>): boolean => found.kind === kind),
    ) ?? 'none'
  )
}

function order(left: Readonly<Change>, right: Readonly<Change>): number {
  const rank = KINDS.indexOf(left.kind) - KINDS.indexOf(right.kind)
  if (rank !== NONE) {
    return rank
  }
  return left.path < right.path ? BEFORE : NEXT
}

/** Keys only one side has, topmost only; an option list (`x|`) whose node both sides hold is that node's change. */
function onlyIn(
  side: ReadonlyMap<string, Row>,
  other: ReadonlyMap<string, Row>,
): readonly string[] {
  const keys = [...side.keys()].filter(
    (key: string): boolean =>
      !other.has(key) &&
      !(
        key.endsWith('|') &&
        other.has(key.slice(NONE, BEFORE)) &&
        side.has(key.slice(NONE, BEFORE))
      ),
  )
  return topmost(new Set(keys))
}

/** Every change from one lock to the next, classified. */
function formatDiff(before: LockData, after: LockData): Report {
  const was = normalRows(before.rows)
  const now = normalRows(after.rows)
  const added = onlyIn(now, was)
  const gone = onlyIn(was, now)
  const pairs = renames(gone, added, [was, now])
  const paired = new Set(pairs.values())
  const changes = [
    ...[...pairs].map(([from, to]: readonly [string, string]): Change =>
      renameChange(from, to),
    ),
    ...gone
      .filter((key: string): boolean => !pairs.has(key))
      .map((key: string): Change => withPath(key, removedFinding(key))),
    ...added
      .filter((key: string): boolean => !paired.has(key))
      .map((key: string): Change => withPath(key, addedFinding(key, now))),
    ...changedRows(was, now),
    ...excludedChanges(before, after),
  ].toSorted(order)
  const chain =
    before.chainId === after.chainId
      ? undefined
      : { before: before.chainId, after: after.chainId }
  return { chain, changes, worst: worstOf(changes) }
}

export { formatDiff, KINDS }
export type { Report }
