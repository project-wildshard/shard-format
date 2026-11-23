import {
  dataFinding,
  directed,
  finding,
  setFinding,
} from './format-diff-data.ts'
import { isRecord } from './format-diff-lock.ts'

import type { Finding } from './format-diff-data.ts'
import type { Json } from './format-diff-lock.ts'
import type { Row, SchemaRow } from './format-diff-normal.ts'

// SHARD-COMPAT FE2: how one changed row is classified. "Additive" means an
// old file still reads on the new reader (never the reverse: every schema is
// strict). "Breaking" means some old file is refused or means something else.
// "Review" is what no rule can decide (a predicate's code, a default, a
// transform). The suggested op is an FE8 migration op.

interface Action {
  readonly kind: string
  readonly type: string
  readonly requirement: Json | undefined
}

const LOOSE = 0
const PLAIN = 1
const STRICT = 2
/** Strictness per shape family: a lower level admits more. */
const LOOSENESS: Readonly<Record<string, readonly [string, number]>> = {
  loose_object: ['object', LOOSE],
  object: ['object', PLAIN],
  object_with_rest: ['object', LOOSE],
  strict_object: ['object', STRICT],
  loose_tuple: ['tuple', LOOSE],
  tuple: ['tuple', PLAIN],
  tuple_with_rest: ['tuple', LOOSE],
  strict_tuple: ['tuple', STRICT],
}
const OPTIONALS: ReadonlySet<string> = new Set([
  'exact_optional',
  'nullish',
  'optional',
  'undefinedable',
])
const NULLABLES: ReadonlySet<string> = new Set(['nullable', 'nullish'])
const UNIONS: ReadonlySet<string> = new Set(['picklist', 'union', 'variant'])
const KIND_FIELD = /\.(?:kind|type)$/u
const SKIPPED_ACTIONS: ReadonlySet<string> = new Set(['metadata'])
const NONE = 0

function text(value: Json | undefined): string {
  if (value === undefined) {
    return 'none'
  }
  return typeof value === 'string' ? value : JSON.stringify(value)
}

/** A type change: within a shape family by looseness, into a union for review, else a break. */
function typeFinding(before: SchemaRow, after: SchemaRow): readonly Finding[] {
  if (before.type === after.type) {
    return []
  }
  const [familyBefore, levelBefore] = LOOSENESS[before.type] ?? ['', PLAIN]
  const [familyAfter, levelAfter] = LOOSENESS[after.type] ?? ['', PLAIN]
  const what = `type ${before.type} -> ${after.type}`
  if (familyBefore !== '' && familyBefore === familyAfter) {
    return [directed(levelAfter < levelBefore, what)]
  }
  if (UNIONS.has(after.type) && !UNIONS.has(before.type)) {
    // It may still admit the old shape as one option: a person checks.
    return [finding('review', `${what} (does an option admit the old?)`)]
  }
  return [finding('breaking', what, 'map')]
}

function admits(wrap: readonly string[], set: ReadonlySet<string>): boolean {
  return wrap.some((type: string): boolean => set.has(type))
}

/** Wrapper changes: gaining optional or nullable admits more; losing it refuses old files. */
function wrapFindings(before: SchemaRow, after: SchemaRow): readonly Finding[] {
  if (before.wrap.join('/') === after.wrap.join('/')) {
    return []
  }
  const out: Finding[] = []
  for (const [set, name] of [
    [OPTIONALS, 'optional'],
    [NULLABLES, 'nullable'],
  ] as const) {
    const now = admits(after.wrap, set)
    if (admits(before.wrap, set) !== now) {
      out.push(
        now
          ? finding('additive', `now ${name}`)
          : finding('breaking', `no longer ${name}`, 'fill'),
      )
    }
  }
  const moved = `wrappers ${before.wrap.join('/')} -> ${after.wrap.join('/')}`
  return out.length > NONE ? out : [finding('review', moved)]
}

function actionOf(action: Json): Action | undefined {
  if (!isRecord(action)) {
    return undefined
  }
  return {
    kind: text(action['kind']),
    type: text(action['type']),
    requirement: action['requirement'],
  }
}

function actionsOf(pipe: Json | undefined): readonly Action[] {
  const actions = Array.isArray(pipe) ? pipe : []
  return actions
    .map((action: Json): Action | undefined => actionOf(action))
    .filter(
      (action: Action | undefined): action is Action =>
        action !== undefined && !SKIPPED_ACTIONS.has(action.kind),
    )
}

/** One validation kept but with a new requirement. */
function requirementFinding(
  type: string,
  before: Json | undefined,
  after: Json | undefined,
): Finding {
  const what = `${type} ${text(before)} -> ${text(after)}`
  if (typeof before === 'number' && typeof after === 'number') {
    if (type.startsWith('max_')) {
      return directed(after > before, what)
    }
    return type.startsWith('min_')
      ? directed(after < before, what)
      : finding('breaking', what)
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    return setFinding(type, before, after)
  }
  return finding('review', what)
}

function sameAction(left: Action, right: Action): boolean {
  return left.kind === right.kind && left.type === right.type
}

function edge(action: Action, verb: 'adds' | 'drops'): Finding {
  if (action.kind !== 'validation') {
    return finding('review', `${verb} ${action.type}`)
  }
  // An added check narrows what reads; a dropped one widens it.
  return directed(verb === 'drops', `${verb} ${action.type}`)
}

/** Pipe changes: an added check narrows, a dropped one widens, a moved limit by its direction. */
function pipeFindings(before: SchemaRow, after: SchemaRow): readonly Finding[] {
  const was = actionsOf(before.facts['pipe'])
  const now = actionsOf(after.facts['pipe'])
  const kept = now.flatMap((action: Action): readonly Finding[] => {
    const old = was.find((other: Action): boolean => sameAction(other, action))
    if (old === undefined) {
      return [edge(action, 'adds')]
    }
    return text(old.requirement) === text(action.requirement)
      ? []
      : [requirementFinding(action.type, old.requirement, action.requirement)]
  })
  const dropped = was
    .filter(
      (action: Action): boolean =>
        !now.some((other: Action): boolean => sameAction(other, action)),
    )
    .map((action: Action): Finding => edge(action, 'drops'))
  return [...kept, ...dropped]
}

/** The other facts: a literal is a break, a default, getter, predicate or async flag is for review. */
function factFindings(
  path: string,
  before: SchemaRow,
  after: SchemaRow,
): readonly Finding[] {
  const keys = new Set([
    ...Object.keys(before.facts),
    ...Object.keys(after.facts),
  ])
  return [...keys]
    .filter(
      (key: string): boolean =>
        key !== 'pipe' && text(before.facts[key]) !== text(after.facts[key]),
    )
    .toSorted()
    .map((key: string): Finding => {
      const moved = `${key} ${text(before.facts[key])} -> ${text(after.facts[key])}`
      if (key !== 'literal') {
        return finding('review', moved)
      }
      return finding(
        'breaking',
        moved,
        KIND_FIELD.test(path) ? 'renameKind' : 'map',
      )
    })
}

/** Every finding for one row present in both locks. */
function changedFindings(
  path: string,
  before: Row,
  after: Row,
): readonly Finding[] {
  if (before.kind === 'data' && after.kind === 'data') {
    return text(before.value) === text(after.value)
      ? []
      : [dataFinding(path, before, after)]
  }
  if (before.kind === 'schema' && after.kind === 'schema') {
    const type = typeFinding(before, after)
    const same = type.length === NONE
    return [
      ...type,
      ...wrapFindings(before, after),
      ...(same ? pipeFindings(before, after) : []),
      ...(same ? factFindings(path, before, after) : []),
    ]
  }
  return [finding('breaking', 'a schema became plain data, or the reverse')]
}

export { changedFindings, OPTIONALS }
