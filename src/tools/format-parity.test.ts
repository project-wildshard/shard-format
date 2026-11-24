import assert from 'node:assert/strict'
import { before, test } from 'node:test'

import { migrateShardfile } from '../format/format-migrate.ts'
import { prepareAssetDecoders } from '../format/shardfile-assets.ts'
import { fixtureFiles, sha256 } from './format-fixtures.ts'
import { firstDifference, parity, parityLines } from './format-parity.ts'

// SHARD-COMPAT FE11b: migrated-old against rebuilt-new parity. Brasscap's 0.1 export migrated to 0.1.0.2 stands in for
// the rebuild (no SDK writes 0.1.0.2 yet): the chain's own copy matches member for member, and a rebuild that differs
// in one field is named by member and JSON path.
// J506: that 0.1 export is the SS3 copy, kept in corpus/legacy.
const FOLDER = 'corpus/legacy/brasscap-mesa-ss3'
const TO = '0.1.0.2'

before(async (): Promise<void> => {
  await prepareAssetDecoders()
})

async function pair(): Promise<{
  old: ReadonlyMap<string, Uint8Array>
  rebuilt: Map<string, Uint8Array>
}> {
  const old = await fixtureFiles({ folder: FOLDER }, TO)
  const rebuilt = new Map(migrateShardfile(old, { hash: sha256, to: TO }).files)
  return { old, rebuilt }
}

test('the migrated old file matches its rebuild, member for member', async (): Promise<void> => {
  const { old, rebuilt } = await pair()
  const result = parity(old, rebuilt)
  assert.deepEqual(result.differences, [])
  assert.equal(result.to, TO)
  assert.ok(result.applied.length > 0)
  assert.match(
    parityLines(result).at(-1) ?? '',
    /^parity: \d+ same, 0 differ$/u,
  )
})

test('a rebuild that parts from the migration is named by member and path', async (): Promise<void> => {
  const { old, rebuilt } = await pair()
  const index: unknown = JSON.parse(
    new TextDecoder().decode(rebuilt.get('shard.json')),
  )
  assert.ok(typeof index === 'object' && index !== null)
  const identity: unknown = Reflect.get(index, 'identity')
  assert.ok(typeof identity === 'object' && identity !== null)
  Reflect.set(identity, 'name', 'Rebuilt Mesa')
  rebuilt.set('shard.json', new TextEncoder().encode(JSON.stringify(index)))
  rebuilt.set('extra.bin', new Uint8Array([1]))
  assert.deepEqual(parity(old, rebuilt).differences, [
    { path: 'extra.bin', verdict: 'only-new' },
    { path: 'shard.json', verdict: 'differs', at: 'identity.name' },
  ])
})

test('the first difference walks arrays and objects', (): void => {
  assert.equal(
    firstDifference({ list: [1, { leaf: 2 }] }, { list: [1, { leaf: 3 }] }),
    'list[1].leaf',
  )
  assert.equal(firstDifference(1, 2), '(root)')
})
