import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { corpusUsage, readUsage } from '../cli/corpus-usage.ts'
import { formatDiff } from '../cli/format-diff.ts'
import { lockOf } from './format-diff-fixture.ts'
import { formatGate } from './format-gate-core.ts'

import type { Usage } from '../cli/corpus-usage.ts'
import type { GateInput } from './format-gate-core.ts'

// SHARD-COMPAT FE13's done-when: a seeded deletion with one user fails
// naming it; at zero users it passes; no or stale usage fails.

const NOW = Date.parse('2026-11-22T12:00:00Z')
const HOUR_MS = 3_600_000
const DAYS = 2
const ROW = { id: 'requires.sdk', since: '0.1.0.1', migration: 'none' }
const listed = lockOf({}, { 'requires.sdk': ROW })
const deleted = lockOf({})

function usage(users: readonly string[], hoursOld: number): Usage {
  return {
    measuredAt: new Date(NOW - hoursOld * HOUR_MS).toISOString(),
    validator: '0.69.2',
    originals: 85,
    deprecations: users.length > 0 ? { 'requires.sdk': users } : {},
    migrations: {},
    pins: 33,
  }
}

function gateWith(found?: Usage): GateInput {
  return {
    base: 'v0.69.1',
    baseVersion: '0.1.0.2',
    version: '0.1.0.2',
    report: formatDiff(listed, deleted),
    breaks: undefined,
    fixture: false,
    migrations: new Set(),
    deprecations: new Set(),
    now: NOW,
    usage: found,
  }
}

describe('the delete gate (FE13)', (): void => {
  it('a deletion with one user fails, naming it', (): void => {
    const used = usage(['pine-hollow r5'], 1)
    const result = formatGate(gateWith(used))
    assert.equal(result.ok, false)
    assert.match(
      result.lines.join('\n'),
      /1 kept originals still use it \(pine-hollow r5\)/u,
    )
  })

  it('a deletion at zero users passes, with no break-file entry', (): void => {
    const clean = usage([], 1)
    assert.deepEqual(formatGate(gateWith(clean)).lines.slice(1), [])
  })

  it('a deletion with no usage record, or a stale one, fails', (): void => {
    assert.match(
      formatGate(gateWith()).lines.join('\n'),
      /needs corpus\/usage\.json/u,
    )
    const stale = formatGate(gateWith(usage([], DAYS * 24)))
    assert.match(stale.lines.join('\n'), /over 24 hours old/u)
  })
})

describe('corpus usage (FE13)', (): void => {
  it('records deprecation users and the chain steps a refused original needed', (): void => {
    const rows = [
      {
        slug: 'pine-hollow',
        revision: 5,
        hash: 'a',
        storedBytes: 1,
        verdict: 'valid',
        reason: 'migrated: fp6-four-part-version, fp8-shardfile-pointer',
        cached: true,
        deprecations: ['requires.sdk'],
      },
      {
        slug: 'dunes',
        revision: 2,
        hash: 'b',
        storedBytes: 1,
        verdict: 'valid',
        reason: undefined,
        cached: true,
        deprecations: [],
      },
    ] as const
    const found = corpusUsage(rows, '0.69.2', new Date(NOW))
    assert.deepEqual(found.deprecations, { 'requires.sdk': ['pine-hollow r5'] })
    assert.deepEqual(found.migrations, {
      'fp6-four-part-version': ['pine-hollow r5'],
      'fp8-shardfile-pointer': ['pine-hollow r5'],
    })
    assert.deepEqual(readUsage(JSON.stringify(found)), found)
  })
})

describe('the delete gate counts engine pins (FE13, pins half)', (): void => {
  it('an original only engine pins blocks the deletion, named as a pin', (): void => {
    const rows = [
      {
        slug: 'pine-hollow',
        revision: 3,
        hash: 'c',
        storedBytes: 1,
        verdict: 'valid',
        reason: undefined,
        cached: true,
        deprecations: ['requires.sdk'],
        pinned: true,
      },
    ] as const
    const found = corpusUsage(rows, '0.69.2', new Date(NOW))
    const result = formatGate(gateWith(found))
    assert.equal(found.pins, 1)
    assert.equal(result.ok, false)
    assert.match(
      result.lines.join('\n'),
      /1 kept originals still use it \(pine-hollow r3 \(engine pin\)\)/u,
    )
  })

  it('a usage record measured without the pins fails the deletion', (): void => {
    const { pins: _unused, ...unpinned } = usage([], 1)
    assert.match(
      formatGate(gateWith(unpinned)).lines.join('\n'),
      /covers no engine shard pins/u,
    )
  })
})
