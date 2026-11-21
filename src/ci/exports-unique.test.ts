import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { ROOT } from '../test/helpers/corpus.ts'

// 0.68.0 listed "./migrations" twice; JSON keeps the last, so the state
// migrations engine imports (migrateLogicalState, LogicalStateSchema) left the
// package without a word. A subpath is listed once.

const KEY = /^ {4}"(?<key>\.[^"]*)":/gmu

test('every exports subpath is listed once', (): void => {
  const text = readFileSync(`${ROOT}/package.json`, 'utf8')
  const start = text.indexOf('"exports": {')
  const block = text.slice(start, text.indexOf('\n  }', start))
  const keys: string[] = []
  for (const found of block.matchAll(KEY)) {
    keys.push(found.groups?.['key'] ?? '')
  }
  const twice = keys.filter(
    (key: string, at: number): boolean => keys.indexOf(key) !== at,
  )
  assert.deepEqual(twice, [])
  assert.ok(keys.length > 0)
})

test('./migrations is the state migrations and ./formatMigrations the chain', async (): Promise<void> => {
  const state = await import('@wildshard/shard-format/migrations')
  const chain = await import('@wildshard/shard-format/formatMigrations')
  assert.equal(typeof state.migrateLogicalState, 'function')
  assert.ok(Array.isArray(chain.FORMAT_MIGRATIONS))
})
