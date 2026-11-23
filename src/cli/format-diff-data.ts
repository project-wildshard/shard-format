import type { Json } from './format-diff-lock.ts'
import type { DataRow } from './format-diff-normal.ts'

// SHARD-COMPAT FE2: the findings type, and how a plain data row (an option
// list, a limit constant, a table) is classified. Schema rows:
// format-diff-rules.ts.

type ChangeKind = 'additive' | 'breaking' | 'deprecation' | 'review'
type MigrationOp =
  | 'drop'
  | 'fill'
  | 'map'
  | 'moveSection'
  | 'rename'
  | 'renameKind'

interface Finding {
  readonly kind: ChangeKind
  readonly what: string
  readonly op?: MigrationOp
}

interface Change extends Finding {
  readonly path: string
  readonly rename?: { readonly from: string; readonly to: string }
}

const RAISE_NAME = /(?:max|limit|cap|budget|ceiling)[^.#]*$/iu
const FLOOR_NAME = /(?:min|floor)[^.#]*$/iu
const NONE = 0
const NEXT = 1

function finding(kind: ChangeKind, what: string, op?: MigrationOp): Finding {
  return op === undefined ? { kind, what } : { kind, what, op }
}

/** A limit's move: up widens a ceiling, down widens a floor. */
function directed(widens: boolean, what: string): Finding {
  return finding(widens ? 'additive' : 'breaking', what)
}

/** Members added only widen; any removed is a break (an old file may hold it). */
function setFinding(
  what: string,
  before: readonly Json[],
  after: readonly Json[],
): Finding {
  const was = new Set(before.map((item: Json): string => JSON.stringify(item)))
  const now = new Set(after.map((item: Json): string => JSON.stringify(item)))
  const gone = [...was].filter((item: string): boolean => !now.has(item))
  const added = [...now].filter((item: string): boolean => !was.has(item))
  if (gone.length > NONE) {
    return finding('breaking', `${what} removes ${gone.join(', ')}`, 'map')
  }
  return added.length > NONE
    ? finding('additive', `${what} adds ${added.join(', ')}`)
    : finding('review', `${what} reordered`)
}

/** A number constant by its name: a ceiling, a floor, or for review. */
function numberFinding(name: string, before: number, after: number): Finding {
  const moved = `${name} ${String(before)} -> ${String(after)}`
  if (RAISE_NAME.test(name)) {
    return directed(after > before, moved)
  }
  if (FLOOR_NAME.test(name)) {
    return directed(after < before, moved)
  }
  return finding('review', moved)
}

/** A plain data row: option lists by membership, named limits by direction, the rest for review. */
function dataFinding(path: string, before: DataRow, after: DataRow): Finding {
  const name = path.slice(path.lastIndexOf('#') + NEXT)
  if (Array.isArray(before.value) && Array.isArray(after.value)) {
    return setFinding(
      path.endsWith('|') ? 'options' : 'list',
      before.value,
      after.value,
    )
  }
  if (typeof before.value === 'number' && typeof after.value === 'number') {
    return numberFinding(name, before.value, after.value)
  }
  return finding('review', `${name} value changed`)
}

export { dataFinding, directed, finding, setFinding }
export type { Change, ChangeKind, Finding, MigrationOp }
