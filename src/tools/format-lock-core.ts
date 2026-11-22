import { createHash } from 'node:crypto'

import {
  byKey,
  codeOf,
  dataOf,
  isRecord,
  isSchema,
  ownRow,
  plainData,
} from './format-lock-data.ts'

import type { Node, Rows } from './format-lock-data.ts'

// SHARD-COMPAT FE1 (Q40): the format lock. Every package export becomes rows:
// a valibot schema is walked node by node, one row per node holding only its
// own facts (type, expects, pipe actions and their requirements), so one
// `maxLength` change moves one row; a primitive or a plain data constant
// (limits, markers, ABI tables) is one row of its value; a function is
// excluded, with that reason. A predicate, a lazy getter or a function
// default is held as a hash of its source. A schema seen before is written
// as a `ref` to its first path, so a shared schema has one home. The chain
// id hashes the migration chain's sources with comments and spacing
// stripped: a docs or comment edit leaves the lock as it was.

type Excluded = Record<string, string>

/** What one export loaded as: a module's exports, a JSON file's data, or why it holds nothing to lock. */
type Loaded =
  | { readonly module: Node }
  | { readonly json: unknown }
  | { readonly why: string }

const CHILD_KEYS = [
  'entries',
  'item',
  'items',
  'options',
  'wrapped',
  'rest',
  'key',
  'value',
] as const
type ChildKey = (typeof CHILD_KEYS)[number]
const FUNCTION_REASON =
  'function: behaviour, not a shape (its schema inputs are locked)'
const RECORD_REASON =
  'not plain data: a class instance or a record holding functions'

/** Short path marks: `.name` an entry, `[]` an array item, `[n]` a tuple item, `|n` a union option, `?` the wrapped schema. */
const MARK: Readonly<Record<ChildKey, string>> = {
  entries: '.',
  item: '[]',
  items: '[',
  options: '|',
  wrapped: '?',
  rest: '...',
  key: '{k}',
  value: '{v}',
}

/** The lock's rows and exclusions, gathered export by export under `<subpath>#<name>`. */
class LockWalk {
  readonly #rows: Rows = {}
  readonly #excluded: Excluded = {}
  readonly #seen = new WeakMap<object, string>()

  public get rows(): Readonly<Rows> {
    return this.#rows
  }

  public get excluded(): Readonly<Excluded> {
    return this.#excluded
  }

  /** One package subpath, as it loaded. */
  public add(subpath: string, loaded: Loaded): void {
    if ('why' in loaded) {
      this.#excluded[subpath] = loaded.why
    } else if ('json' in loaded) {
      this.#rows[`${subpath}#json`] = dataOf(loaded.json)
    } else {
      this.module(subpath, loaded.module)
    }
  }

  /** Every export of one module. */
  public module(subpath: string, module: Node): void {
    for (const [name, value] of Object.entries(module).toSorted(byKey)) {
      this.#export(`${subpath}#${name}`, value)
    }
  }

  #export(at: string, value: unknown): void {
    if (isSchema(value)) {
      this.#schema(value, at)
    } else if (plainData(value)) {
      this.#rows[at] = dataOf(value)
    } else {
      this.#excluded[at] =
        typeof value === 'function' ? FUNCTION_REASON : RECORD_REASON
    }
  }

  #schema(schema: Node, path: string): void {
    const first = this.#seen.get(schema)
    if (first !== undefined) {
      this.#rows[path] = { ref: first }
      return
    }
    this.#seen.set(schema, path)
    this.#rows[path] = ownRow(schema)
    for (const key of CHILD_KEYS) {
      this.#child(schema[key], key, path)
    }
  }

  #child(child: unknown, key: ChildKey, path: string): void {
    if (isSchema(child)) {
      this.#schema(child, `${path}${MARK[key]}`)
    } else if (Array.isArray(child)) {
      this.#list(child, key, path)
    } else if (isRecord(child)) {
      for (const [name, item] of Object.entries(child).toSorted(byKey)) {
        if (isSchema(item)) {
          this.#schema(item, `${path}.${name}`)
        }
      }
    }
  }

  #list(child: readonly unknown[], key: ChildKey, path: string): void {
    if (!child.every((item: unknown): boolean => isSchema(item))) {
      this.#rows[`${path}${MARK[key]}`] = dataOf(child)
      return
    }
    for (const [index, item] of child.entries()) {
      if (isSchema(item)) {
        this.#schema(
          item,
          key === 'items'
            ? `${path}[${String(index)}]`
            : `${path}|${String(index)}`,
        )
      }
    }
  }
}

/** The chain id: the migration chain's sources, code only. */
function chainIdOf(sources: Readonly<Record<string, string>>): string {
  const parts = Object.entries(sources)
    .toSorted(byKey)
    .map(
      ([file, source]: readonly [string, string]): string =>
        `${file}\n${codeOf(source)}`,
    )
  return createHash('sha256').update(parts.join('\n')).digest('hex')
}

export { chainIdOf, LockWalk }
export type { Excluded, Loaded }
