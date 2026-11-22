import { createHash } from 'node:crypto'

// SHARD-COMPAT FE1: how a value, a pipe action or a schema node's own facts
// become lock data. The walk over exports is format-lock-core.ts.

type Json =
  | boolean
  | number
  | string
  | null
  | readonly Json[]
  | { readonly [key: string]: Json }
type Rows = Record<string, Json>
type Node = Readonly<Record<string, unknown>>

// A schema node's `kind` is always `schema`, and `async: false` is the
// default; only an async schema records it.
const OWN_KEYS = ['type', 'expects', 'literal'] as const
const ACTION_KEYS = ['kind', 'type', 'expects'] as const
const SOURCE_KEYS = ['getter', 'requirement'] as const
const SCALARS: ReadonlySet<string> = new Set([
  'bigint',
  'boolean',
  'number',
  'string',
])
const NONE = 0
const NEXT = 1
const SHORT = 16
// A pipe's first entry is its base schema, whose facts are the node's own.
const PIPE_HEAD = 1
const BEFORE = -1
const AFTER = 1

/** The sha256 of text, short enough to read in a diff. */
function digest(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(NONE, SHORT)
}

/** Source text without comments or spacing, so only code moves a hash. */
function codeOf(source: string): string {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//gu, '')
    .replaceAll(/(?<lead>^|[^:'"`\\])\/\/[^\n]*/gu, '$<lead>')
    .replaceAll(/\s+/gu, ' ')
    .trim()
}

/** Code-unit order, the same on every machine (no locale). */
function byKey(
  [left]: readonly [string, unknown],
  [right]: readonly [string, unknown],
): number {
  if (left === right) {
    return NONE
  }
  return left < right ? BEFORE : AFTER
}

function isRecord(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSchema(value: unknown): value is Node {
  return (
    isRecord(value) &&
    value['kind'] === 'schema' &&
    typeof value['type'] === 'string'
  )
}

/** A function by its code's hash, a pattern by its source. */
function sourceOf(value: unknown): Json {
  return typeof value === 'function'
    ? `fn:${digest(codeOf(String(value)))}`
    : `re:${String(value)}`
}

/** A scalar, function or pattern as lock data. */
function scalarOf(value: unknown): Json {
  if (typeof value === 'function' || value instanceof RegExp) {
    return sourceOf(value)
  }
  if (typeof value === 'bigint') {
    return `${String(value)}n`
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : String(value)
  }
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  ) {
    return value
  }
  return `<${typeof value}>`
}

/** A requirement, default, literal or constant as lock data. */
function dataOf(value: unknown, depth = NONE): Json {
  const deeper = (item: unknown): Json => dataOf(item, depth + NEXT)
  if (value instanceof Set || Array.isArray(value)) {
    return depth > SHORT && Array.isArray(value)
      ? '<deep>'
      : [...(value as Iterable<unknown>)].map((item: unknown): Json =>
          deeper(item),
        )
  }
  if (typeof value !== 'object' || value === null || value instanceof RegExp) {
    return scalarOf(value)
  }
  if (depth > SHORT) {
    return '<deep>'
  }
  if (isSchema(value)) {
    return `schema:${String(value['type'])}`
  }
  return Object.fromEntries(
    Object.entries(value)
      .toSorted(byKey)
      .map(
        ([key, item]: readonly [string, unknown]): readonly [string, Json] => [
          key,
          deeper(item),
        ],
      ),
  )
}

/** Like dataOf, with `undefined` spelled out (a requirement or literal may be it). */
function factOf(value: unknown): Json {
  return value === undefined ? '<undefined>' : dataOf(value)
}

/** A pipe action's own facts. */
function actionOf(action: unknown): Json {
  if (!isRecord(action)) {
    return factOf(action)
  }
  const row: Rows = {}
  for (const key of ACTION_KEYS) {
    if (action[key] !== undefined) {
      row[key] = dataOf(action[key])
    }
  }
  if ('requirement' in action) {
    row['requirement'] = factOf(action['requirement'])
  }
  return row
}

/** A node's pipe actions, default, and source-held getter or predicate. */
function extrasOf(schema: Node): Rows {
  const row: Rows = {}
  const pipe: unknown = schema['pipe']
  if (Array.isArray(pipe)) {
    row['pipe'] = pipe
      .slice(PIPE_HEAD)
      .map((action: unknown): Json => actionOf(action))
  }
  if (schema['default'] !== undefined) {
    row['default'] = dataOf(schema['default'])
  }
  for (const key of SOURCE_KEYS) {
    if (typeof schema[key] === 'function') {
      row[key] = dataOf(schema[key])
    }
  }
  return row
}

/** One schema node's own facts, without its children. */
function ownRow(schema: Node): Json {
  const row: Rows = {}
  for (const key of OWN_KEYS) {
    if (schema[key] !== undefined) {
      row[key] = dataOf(schema[key])
    }
  }
  if (schema['async'] === true) {
    row['async'] = true
  }
  return { ...row, ...extrasOf(schema) }
}

/** The values inside an array, a set or a plain object (no class, no prototype chain); none for anything else. */
function childrenOf(value: unknown): readonly unknown[] | undefined {
  if (Array.isArray(value) || value instanceof Set) {
    return [...(value as Iterable<unknown>)]
  }
  if (!isRecord(value)) {
    return undefined
  }
  const proto: unknown = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
    ? Object.values(value)
    : undefined
}

/** Whether a constant is plain data a format reader depends on (not a class instance or a module of functions). */
function plainData(value: unknown, depth = NONE): boolean {
  if (value === null || SCALARS.has(typeof value)) {
    return true
  }
  if (depth > SHORT || typeof value === 'function') {
    return false
  }
  const children = childrenOf(value)
  return (
    children?.every((item: unknown): boolean =>
      plainData(item, depth + NEXT),
    ) ?? false
  )
}

export { byKey, codeOf, dataOf, digest, isRecord, isSchema, ownRow, plainData }
export type { Json, Node, Rows }
