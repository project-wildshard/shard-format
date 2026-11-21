// oxlint-disable typescript/prefer-readonly-parameter-types -- an op edits the shard it is handed, in place
/** The migration chain's ops (SHARD-COMPAT FE8): small data-only edits a step is built from, so a step reads as what it
 * changes. Each op addresses one JSON document (the index, a section by name, or a JSON cook mount by path) and a key
 * path inside it, where `*` stands for every element of an array or every value of an object. */
import type { MigratingShard } from './format-migrations.ts'

type JsonRecord = Record<string, unknown>
type Op = (shard: MigratingShard) => void

/** The document an op edits. */
type Target =
  | { readonly index: true }
  | { readonly section: string }
  | { readonly mount: string }

const EVERY = '*'
const NONE = 0

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function documentOf(shard: Readonly<MigratingShard>, target: Target): unknown {
  if ('index' in target) {
    return shard.index
  }
  if ('section' in target) {
    return shard.sections.get(target.section)
  }
  return shard.mounts.get(target.mount)
}

/** The children `key` names under each of `values`. */
function step(values: readonly unknown[], key: string): unknown[] {
  return values.flatMap((value: unknown): unknown[] => {
    if (key === EVERY) {
      if (Array.isArray(value)) {
        return value
      }
      return isRecord(value) ? Object.values(value) : []
    }
    return isRecord(value) && Object.hasOwn(value, key) ? [value[key]] : []
  })
}

/** Every object at `path` in the target document. */
function objectsAt(
  shard: Readonly<MigratingShard>,
  target: Target,
  path: readonly string[],
): JsonRecord[] {
  let values: unknown[] = [documentOf(shard, target)]
  for (const key of path) {
    values = step(values, key)
  }
  return values.filter((value: unknown): value is JsonRecord => isRecord(value))
}

/** Rewrite an object's own keys in order, so a renamed key keeps its place. */
function rewriteKeys(
  row: JsonRecord,
  entries: readonly (readonly [string, unknown])[],
): void {
  for (const key of Object.keys(row)) {
    Reflect.deleteProperty(row, key)
  }
  for (const [key, value] of entries) {
    row[key] = value
  }
}

/** `from` becomes `to` in each object at `path`; an object holding both with different values is refused. */
function rename(
  target: Target,
  path: readonly string[],
  keys: Readonly<{ from: string; to: string }>,
): Op {
  return (shard: MigratingShard): void => {
    for (const row of objectsAt(shard, target, path)) {
      if (Object.hasOwn(row, keys.from)) {
        if (Object.hasOwn(row, keys.to) && row[keys.to] !== row[keys.from]) {
          throw new Error(`Rename ${keys.from} to ${keys.to}: both are set`)
        }
        const entries = Object.entries(row)
          .filter(
            ([key]: readonly [string, unknown]): boolean => key !== keys.to,
          )
          .map(
            ([key, value]: readonly [string, unknown]): readonly [
              string,
              unknown,
            ] => (key === keys.from ? [keys.to, value] : [key, value]),
          )
        rewriteKeys(row, entries)
      }
    }
  }
}

/** `key` leaves each object at `path`. */
function drop(target: Target, path: readonly string[], key: string): Op {
  return (shard: MigratingShard): void => {
    for (const row of objectsAt(shard, target, path)) {
      Reflect.deleteProperty(row, key)
    }
  }
}

/** Each object at `path` without `key` gets `value` (a fresh copy each time). */
function fill(
  target: Target,
  path: readonly string[],
  field: Readonly<{ key: string; value: unknown }>,
): Op {
  return (shard: MigratingShard): void => {
    for (const row of objectsAt(shard, target, path)) {
      if (!Object.hasOwn(row, field.key)) {
        row[field.key] = structuredClone(field.value)
      }
    }
  }
}

/** Each object at `path` holding `key` has its value replaced by `change(value)`. */
function map(
  target: Target,
  path: readonly string[],
  field: Readonly<{ key: string; change: (value: unknown) => unknown }>,
): Op {
  return (shard: MigratingShard): void => {
    for (const row of objectsAt(shard, target, path)) {
      if (Object.hasOwn(row, field.key)) {
        row[field.key] = field.change(row[field.key])
      }
    }
  }
}

/** The section `from` becomes `to` under schema id `schema`: its payload, index row and file path move together. */
function moveSection(
  sections: Readonly<{ from: string; to: string; schema: string }>,
): Op {
  return (shard: MigratingShard): void => {
    const payload = shard.sections.get(sections.from)
    const rows: unknown = shard.index['sections']
    const row: unknown = Array.isArray(rows)
      ? rows.find(
          (entry: unknown): boolean =>
            isRecord(entry) && entry['name'] === sections.from,
        )
      : undefined
    if (payload === undefined || !isRecord(row)) {
      return
    }
    if (shard.sections.has(sections.to)) {
      throw new Error(`Move ${sections.from} to ${sections.to}: it exists`)
    }
    shard.sections.delete(sections.from)
    shard.sections.set(sections.to, payload)
    Object.assign(row, {
      name: sections.to,
      path: `sections/${sections.to}.json`,
      schema: sections.schema,
    })
  }
}

/** Every string equal to `from` under one of `keys`, anywhere in a section or JSON mount, becomes `to`. */
function renameKind(
  kinds: Readonly<{ from: string; to: string; keys: readonly string[] }>,
): Op {
  const keys = new Set(kinds.keys)
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item)
      }
    } else if (isRecord(value)) {
      for (const [key, item] of Object.entries(value)) {
        if (keys.has(key) && item === kinds.from) {
          value[key] = kinds.to
        } else {
          visit(item)
        }
      }
    }
  }
  return (shard: MigratingShard): void => {
    for (const value of [
      ...shard.sections.values(),
      ...shard.mounts.values(),
    ]) {
      visit(value)
    }
  }
}

/** Run ops in order as one step's `apply`. */
function ops(...steps: readonly Op[]): Op {
  return (shard: MigratingShard): void => {
    for (const op of steps) {
      op(shard)
    }
  }
}

/** Whether any object at `path` still holds `key` (a repair step's `repairs`). */
function holds(
  target: Target,
  path: readonly string[],
  key: string,
): (shard: Readonly<MigratingShard>) => boolean {
  return (shard: Readonly<MigratingShard>): boolean =>
    objectsAt(shard, target, path).filter(
      (row: Readonly<JsonRecord>): boolean => Object.hasOwn(row, key),
    ).length > NONE
}

export {
  type Op,
  type Target,
  drop,
  fill,
  holds,
  map,
  moveSection,
  ops,
  rename,
  renameKind,
}
