import assert from 'node:assert/strict'
import { test } from 'node:test'

import { judge, zoneSnapshotOffenders } from './zone-snapshot-core.ts'

// ZONE-SNAPSHOTS ZS1 (J507): the guard refuses each kind of zone snapshot a lane might check in.
const CURRENT = '0.1.0.6'
const ZONES = ['pine-hollow', 'nalati-grasslands', 'brasscap-mesa']

function scan(files: Readonly<Record<string, string>>): readonly string[] {
  return zoneSnapshotOffenders({
    paths: Object.keys(files),
    read: (file: string): string => files[file] ?? '',
    current: CURRENT,
    zones: ZONES,
  })
}

test('a pin record outside the export pin is refused', (): void => {
  const record = JSON.stringify({
    slug: 'pine-hollow',
    revision: 7,
    hash: 'a'.repeat(64),
  })
  assert.deepEqual(
    scan({
      'corpus/old.json': record,
      'corpus/exports/brasscap-mesa.pin.json': record,
    }),
    ['pin-record corpus/old.json'],
  )
  const cache = `const FILE = \`\${homedir()}/.cache/wildshard/pins/\${PIN}.tar\`\nconst PIN = '${'b'.repeat(64)}'`
  assert.deepEqual(scan({ 'src/format/pine.test.ts': cache }), [
    'pin-record src/format/pine.test.ts',
  ])
})

test('a 0.1 shard folder is refused, a made-up one passes at any format', (): void => {
  assert.deepEqual(
    scan({
      'corpus/old/shard.json': JSON.stringify({
        formatVersion: 2,
        version: '0.1',
      }),
    }),
    ['shard-folder corpus/old/shard.json'],
  )
  assert.deepEqual(
    scan({
      'src/test/fixtures/z/shard.json': JSON.stringify({
        formatVersion: CURRENT,
        identity: { slug: 'made-up' },
      }),
    }),
    [],
  )
  assert.deepEqual(
    scan({
      'src/test/fixtures/old/shard.json': JSON.stringify({
        version: '0.1',
        identity: { slug: 'cli-fixture' },
      }),
      'src/test/fixtures/zone/shard.json': JSON.stringify({
        version: '0.1',
        identity: { slug: 'pine-hollow' },
      }),
    }),
    ['shard-folder src/test/fixtures/zone/shard.json'],
  )
  assert.deepEqual(
    scan({
      'corpus/exports/brasscap-mesa/shard.json': JSON.stringify({
        formatVersion: '0.1.0.4',
      }),
    }),
    ['shard-folder corpus/exports/brasscap-mesa/shard.json'],
  )
})

test('a fixture naming a zone revision is refused', (): void => {
  assert.deepEqual(
    scan({
      'src/test/fixtures/pine-hollow-r7.json': '{}',
      'project/journal/pine-r7.md': '',
    }),
    ['revision-path src/test/fixtures/pine-hollow-r7.json'],
  )
})

test('chain fixtures may not name a pin or chainOf', (): void => {
  assert.deepEqual(
    scan({
      'corpus/format-versions/0.1.0.2/fixtures.json':
        '{"fixtures":[{"chainOf":"0.1.0.1"}]}',
      'corpus/format-versions/0.1.0.3/fixtures.json':
        '{"fixtures":[{"before":"before.json"}]}',
    }),
    ['chain-snapshot corpus/format-versions/0.1.0.2/fixtures.json'],
  )
})

test('the baseline only shrinks', (): void => {
  assert.deepEqual(judge(['a', 'b'], ['a', 'b', 'c']), {
    added: [],
    gone: ['c'],
  })
  assert.deepEqual(judge(['a', 'd'], ['a']), { added: ['d'], gone: [] })
})
