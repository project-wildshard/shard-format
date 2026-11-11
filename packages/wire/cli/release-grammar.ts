// The version half of `wire check`'s release rules (row WR6): versions never
// fall; a limit change, a new node kind or a new key on a kind needs a major,
// since an old peer can't parse its tables; any other lock change needs a
// minor above the release's.

import { isRecord } from './release-entries.ts'

import type { LockRecord, ReleaseLock } from './release-entries.ts'

/** What only a major may change: a peer can't read past them (5.5). */
const MAJOR_KEYS = [
  'version',
  'maxRowFields',
  'tableLimits',
  'v0SchemaHash',
] as const

/** Record a node's kind, if it has one, with the keys it carries. */
function addKind(out: Map<string, Set<string>>, value: LockRecord): void {
  const { kind } = value
  if (typeof kind === 'string') {
    const keys = out.get(kind) ?? new Set<string>()
    for (const key of Object.keys(value)) {
      keys.add(key)
    }
    out.set(kind, keys)
  }
}

/** Every node kind a lock uses, with the keys each carries. */
function kindsOf(
  value: unknown,
  out = new Map<string, Set<string>>(),
): Map<string, Set<string>> {
  if (Array.isArray(value)) {
    for (const item of value) {
      kindsOf(item, out)
    }
  } else if (isRecord(value)) {
    addKind(out, value)
    for (const inner of Object.values(value)) {
      kindsOf(inner, out)
    }
  }
  return out
}

/** A node kind, or a key on one, that the release never had: old peers can't parse its tables (5.5). */
function grammarProblems(
  old: ReleaseLock,
  next: ReleaseLock,
): readonly string[] {
  const [was, is] = [kindsOf(old), kindsOf(next)]
  const problems: string[] = []
  for (const [kind, keys] of is) {
    const known = was.get(kind)
    if (known === undefined) {
      problems.push(
        `node kind ${kind} is new: a new grammar kind needs a WIRE_MAJOR bump (5.5)`,
      )
    } else {
      problems.push(
        ...[...keys]
          .filter((key: string): boolean => !known.has(key))
          .map(
            (key: string): string =>
              `node kind ${kind} gained key ${key}: that needs a WIRE_MAJOR bump (5.5)`,
          ),
      )
    }
  }
  return problems
}

/** The version rules: versions never fall; limits and grammar need a major; any change needs a minor. */
function versionProblems(
  old: ReleaseLock,
  next: ReleaseLock,
): readonly string[] {
  if (
    next.wireMajor < old.wireMajor ||
    (next.wireMajor === old.wireMajor && next.wireMinor < old.wireMinor)
  ) {
    return ['the wire version went down (5.5)']
  }
  if (next.wireMajor > old.wireMajor) {
    return []
  }
  const limits = MAJOR_KEYS.filter(
    (key: string): boolean =>
      JSON.stringify(old[key]) !== JSON.stringify(next[key]),
  )
  const changed = JSON.stringify(old) !== JSON.stringify(next)
  return [
    ...limits.map(
      (key: string): string =>
        `${key} changed: that needs a WIRE_MAJOR bump (5.5)`,
    ),
    ...grammarProblems(old, next),
    ...(changed && next.wireMinor <= old.wireMinor
      ? [
          `the lock changed since the release: it needs WIRE_MINOR above ${String(old.wireMinor)} (5.5)`,
        ]
      : []),
  ]
}

export { versionProblems }
