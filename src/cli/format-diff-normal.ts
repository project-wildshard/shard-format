import { isRecord } from './format-diff-lock.ts'

import type { Json } from './format-diff-lock.ts'

// SHARD-COMPAT FE2: a lock's rows put in a form two versions compare on.
// 1. A `ref` row takes its target's row and the target's whole subtree, so
//    sharing a schema or walking modules in a new order moves nothing.
// 2. `expects` is dropped: it is message text derived from the other facts.
// 3. A wrapper (optional, nullable, ...) folds into the node it wraps, as a
//    `wrap` list, so making a field optional changes one row, not the path
//    of every row under it.
// 4. A variant option is keyed by its discriminating literal (`|=boss`), not
//    its index, so inserting an option renames none of the others.

interface SchemaRow {
  readonly kind: 'schema'
  readonly type: string
  readonly wrap: readonly string[]
  readonly facts: Readonly<Record<string, Json>>
}
interface DataRow {
  readonly kind: 'data'
  readonly value: Json
}
type Row = DataRow | SchemaRow

const MARKS: ReadonlySet<string> = new Set(['.', '[', '|', '?', '{'])
const SCHEMA_KEYS: ReadonlySet<string> = new Set([
  'async',
  'default',
  'expects',
  'getter',
  'literal',
  'pipe',
  'requirement',
  'type',
])
const WRAPPERS: ReadonlySet<string> = new Set([
  'exact_optional',
  'non_nullable',
  'non_nullish',
  'non_optional',
  'nullable',
  'nullish',
  'optional',
  'undefinedable',
])
const MAX_PASSES = 64
const OPTION = /^(?<group>.*)\|(?<index>\d+)$/u
const UNSAFE = /[.[|?{}#]/gu
const NONE = 0
const NEXT = 1
const HALF = 2
const SEGMENT = /\|\d+/gu

function refOf(value: Json | undefined): string | undefined {
  return isRecord(value) && typeof value['ref'] === 'string'
    ? value['ref']
    : undefined
}

/** The first index in a sorted list at or after `key`. */
function lowerBound(sorted: readonly string[], key: string): number {
  let low = NONE
  let high = sorted.length
  while (low < high) {
    const middle = Math.floor((low + high) / HALF)
    if ((sorted[middle] ?? '') < key) {
      low = middle + NEXT
    } else {
      high = middle
    }
  }
  return low
}

/** The keys strictly under `prefix` (a mark follows it), from a sorted list. */
function under(sorted: readonly string[], prefix: string): readonly string[] {
  const found: string[] = []
  for (const key of sorted.slice(lowerBound(sorted, prefix))) {
    if (!key.startsWith(prefix)) {
      break
    }
    if (MARKS.has(key.charAt(prefix.length))) {
      found.push(key)
    }
  }
  return found
}

function expandOnce(rows: ReadonlyMap<string, Json>): Map<string, Json> {
  const sorted = [...rows.keys()].toSorted()
  const out = new Map(rows)
  for (const [key, value] of rows) {
    const target = refOf(value)
    const row = target === undefined ? undefined : rows.get(target)
    if (target !== undefined && row !== undefined) {
      out.set(key, row)
      for (const sub of under(sorted, target)) {
        out.set(`${key}${sub.slice(target.length)}`, rows.get(sub) ?? row)
      }
    }
  }
  return out
}

/** Every `ref` replaced by its target and the target's subtree. */
function expandRefs(raw: Readonly<Record<string, Json>>): Map<string, Json> {
  let rows = new Map(Object.entries(raw))
  let passes = NONE
  while (
    passes < MAX_PASSES &&
    [...rows.values()].some(
      (value: Json): boolean => refOf(value) !== undefined,
    )
  ) {
    rows = expandOnce(rows)
    passes += NEXT
  }
  return rows
}

function withoutExpects(pipe: Json): Json {
  return Array.isArray(pipe)
    ? pipe.map((action: Json): Json =>
        isRecord(action)
          ? Object.fromEntries(
              Object.entries(action).filter(
                ([key]: readonly [string, Json]): boolean => key !== 'expects',
              ),
            )
          : action,
      )
    : pipe
}

/** One raw row as a schema node's facts (without `expects`) or plain data. */
function rowOf(value: Json): Row {
  if (
    !isRecord(value) ||
    typeof value['type'] !== 'string' ||
    !Object.keys(value).every((key: string): boolean => SCHEMA_KEYS.has(key))
  ) {
    return { kind: 'data', value }
  }
  const facts: Record<string, Json> = {}
  for (const [key, fact] of Object.entries(value)) {
    if (key !== 'type' && key !== 'expects') {
      facts[key] = key === 'pipe' ? withoutExpects(fact) : fact
    }
  }
  return { kind: 'schema', type: value['type'], wrap: [], facts }
}

/** A wrapper row folded over the row it wraps. */
function folded(outer: SchemaRow, inner: Row): Row {
  if (inner.kind === 'data') {
    return inner
  }
  const outerFacts = Object.entries(outer.facts).map(
    ([key, fact]: readonly [string, Json]): readonly [string, Json] => [
      `wrap:${key}`,
      fact,
    ],
  )
  return {
    ...inner,
    wrap: [...outer.wrap, outer.type, ...inner.wrap],
    facts: { ...inner.facts, ...Object.fromEntries(outerFacts) },
  }
}

/** Wrappers folded into the nodes they wrap, under paths without `?`. */
function foldWrappers(rows: ReadonlyMap<string, Json>): Map<string, Row> {
  const out = new Map<string, Row>()
  for (const key of [...rows.keys()].toSorted()) {
    const row = rowOf(rows.get(key) ?? '')
    const at = key.replaceAll('?', '')
    const outer = out.get(at)
    out.set(
      at,
      outer?.kind === 'schema' && WRAPPERS.has(outer.type) && key !== at
        ? folded(outer, row)
        : row,
    )
  }
  return out
}

function literalText(value: Json | undefined): string {
  if (value === undefined) {
    return ''
  }
  return typeof value === 'string' ? value : JSON.stringify(value)
}

/** Each node's direct literal children, by node path then field name. */
function literalChildren(
  rows: ReadonlyMap<string, Row>,
): ReadonlyMap<string, ReadonlyMap<string, string>> {
  const out = new Map<string, Map<string, string>>()
  for (const [key, row] of rows) {
    const dot = key.lastIndexOf('.')
    const name = key.slice(dot + NEXT)
    if (
      row.kind === 'schema' &&
      row.type === 'literal' &&
      dot > NONE &&
      !/[[|{]/u.test(name)
    ) {
      const parent = key.slice(NONE, dot)
      const children = out.get(parent) ?? new Map<string, string>()
      children.set(name, literalText(row.facts['literal']))
      out.set(parent, children)
    }
  }
  return out
}

/** The literal each option of one union holds under a name every option shares, by option path. */
function discriminants(
  literals: ReadonlyMap<string, ReadonlyMap<string, string>>,
  options: readonly string[],
): readonly (readonly [string, string])[] {
  const found = options.map(
    (option: string): ReadonlyMap<string, string> =>
      literals.get(option) ?? new Map<string, string>(),
  )
  const name = [...(found.at(NONE)?.keys() ?? [])].find(
    (candidate: string): boolean => {
      const values = found.map(
        (children: ReadonlyMap<string, string>): string | undefined =>
          children.get(candidate),
      )
      return (
        values.every(
          (value: string | undefined): boolean => value !== undefined,
        ) && new Set(values).size === values.length
      )
    },
  )
  return name === undefined
    ? []
    : options.map((option: string, at: number): readonly [string, string] => [
        option,
        (found[at]?.get(name) ?? '').replaceAll(UNSAFE, '_'),
      ])
}

/** A key with every renamed option segment (`|n`) spelled by its literal (`|=boss`). */
function renamed(key: string, renames: ReadonlyMap<string, string>): string {
  let out = ''
  let from = NONE
  for (const match of key.matchAll(SEGMENT)) {
    const end = match.index + match[NONE].length
    const literal = renames.get(key.slice(NONE, end))
    if (
      literal !== undefined &&
      (end === key.length || MARKS.has(key.charAt(end)))
    ) {
      out += `${key.slice(from, match.index)}|=${literal}`
      from = end
    }
  }
  return `${out}${key.slice(from)}`
}

/** Variant options keyed by their discriminating literal. */
function keyVariants(rows: ReadonlyMap<string, Row>): Map<string, Row> {
  const groups = new Map<string, string[]>()
  for (const key of rows.keys()) {
    const group = OPTION.exec(key)?.groups?.['group']
    if (group !== undefined) {
      groups.set(group, [...(groups.get(group) ?? []), key])
    }
  }
  const literals = literalChildren(rows)
  const renames = new Map(
    [...groups.values()].flatMap(
      (options: readonly string[]): readonly (readonly [string, string])[] =>
        discriminants(literals, options),
    ),
  )
  return new Map(
    [...rows].map(
      ([key, row]: readonly [string, Row]): readonly [string, Row] => [
        renamed(key, renames),
        row,
      ],
    ),
  )
}

/** A lock's rows in compare form. */
function normalRows(raw: Readonly<Record<string, Json>>): Map<string, Row> {
  return keyVariants(foldWrappers(expandRefs(raw)))
}

export { MARKS, normalRows, WRAPPERS }
export type { DataRow, Row, SchemaRow }
