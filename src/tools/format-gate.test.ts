import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { exactOptional, strictObject, string } from 'valibot'

import { formatDiff } from '../cli/format-diff.ts'
import { lockOf } from './format-diff-fixture.ts'
import { formatGate, readBreakFile } from './format-gate-core.ts'

import type { BreakFile, GateInput } from './format-gate-core.ts'

// SHARD-COMPAT FE4's done-when: seeded pull requests through the gate.

const BASE = '0.1.0.2'
const NEXT = '0.1.1.0'
const TAG = 'v0.69.1'
const PATH = './sample#Shard.tag'

const before = lockOf({ Shard: strictObject({ tag: string() }) })
const Note = exactOptional(string())
const additive = lockOf({ Shard: strictObject({ tag: string(), note: Note }) })
const breaking = lockOf({ Shard: strictObject({}) })
const deprecated = lockOf(
  { Shard: strictObject({ tag: string() }) },
  { 'shard.tag': { id: 'shard.tag', since: NEXT, migration: 'none' } },
)

function input(
  after: Readonly<ReturnType<typeof lockOf>>,
  extra: Partial<GateInput>,
): GateInput {
  return {
    base: TAG,
    baseVersion: BASE,
    version: BASE,
    report: formatDiff(before, after),
    breaks: undefined,
    fixture: false,
    migrations: new Set(['drop-shard-tag']),
    deprecations: new Set(['shard.tag']),
    usage: undefined,
    ...extra,
  }
}

function breaks(
  version: string,
  entry: BreakFile['entries'][number],
): BreakFile {
  return { version, entries: [entry] }
}

describe('the format gate (FE4)', (): void => {
  it('an additive change passes with no break file', (): void => {
    assert.equal(formatGate(input(additive, {})).ok, true)
  })

  it('a breaking change with no break file fails, naming the path', (): void => {
    const result = formatGate(input(breaking, {}))
    assert.equal(result.ok, false)
    assert.match(
      result.lines.join('\n'),
      /\.\/sample#Shard\.tag: breaking \(field removed\)/u,
    )
  })

  it('a breaking change with a migration, a fixture and a rise passes', (): void => {
    const entry = { path: PATH, migration: 'drop-shard-tag' }
    const result = formatGate(
      input(breaking, {
        version: NEXT,
        breaks: breaks(NEXT, entry),
        fixture: true,
      }),
    )
    assert.deepEqual(result.lines.slice(1), [])
    assert.equal(result.ok, true)
  })

  it('a migration without a version rise or a fixture fails, naming both', (): void => {
    const entry = { path: PATH, migration: 'drop-shard-tag' }
    const text = formatGate(
      input(breaking, { breaks: breaks(BASE, entry) }),
    ).lines.join('\n')
    assert.match(text, /must rise above v0\.69\.1's 0\.1\.0\.2/u)
    assert.match(text, /corpus\/format-versions\/0\.1\.0\.2\/ needs a fixture/u)
  })
})

describe('the format gate (FE4): what an entry must name', (): void => {
  it('a migration id the chain lacks fails', (): void => {
    const entry = { path: PATH, migration: 'no-such-step' }
    const result = formatGate(
      input(breaking, {
        version: NEXT,
        breaks: breaks(NEXT, entry),
        fixture: true,
      }),
    )
    assert.match(
      result.lines.join('\n'),
      /migration no-such-step is not in FORMAT_MIGRATIONS/u,
    )
  })

  it('a deprecation change passes as it is (FE7 starts counting it)', (): void => {
    assert.equal(formatGate(input(deprecated, {})).ok, true)
  })

  it('a break named by a deprecation id passes with a rise and a fixture', (): void => {
    const entry = { path: PATH, deprecation: 'shard.tag' }
    const pr = input(breaking, {
      version: NEXT,
      breaks: breaks(NEXT, entry),
      fixture: true,
    })
    assert.equal(formatGate(pr).ok, true)
  })
})

describe('the format gate (FE4): acknowledgements and the file itself', (): void => {
  it('noFileChange passes a change with no rise', (): void => {
    const entry = { path: PATH, noFileChange: 'only importers read it' }
    const pr = input(breaking, { breaks: breaks(BASE, entry) })
    assert.equal(formatGate(pr).ok, true)
  })

  it('an entry naming nothing fails', (): void => {
    const result = formatGate(
      input(breaking, { breaks: breaks(BASE, { path: PATH }) }),
    )
    assert.match(
      result.lines.join('\n'),
      /names no migration, deprecation or noFileChange/u,
    )
  })

  it('a break file must carry its own version', (): void => {
    const text = JSON.stringify({ version: NEXT, entries: [] })
    assert.throws(
      (): BreakFile => readBreakFile(text, BASE),
      /names version 0\.1\.1\.0/u,
    )
    assert.deepEqual(readBreakFile(text, NEXT).entries, [])
  })
})
