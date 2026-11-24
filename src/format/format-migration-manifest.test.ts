/* oxlint-disable eslint/id-length -- a spawn's coordinates are x, y and z, as world/spawn names them */
import { expect, test } from 'vitest'

import {
  MOVED_WORDS,
  discoveryMovedWords,
  manifestMovedWords,
} from './format-migration-manifest.ts'
import { FORMAT_MIGRATIONS } from './format-migrations.ts'
import {
  GONE_WORDS,
  checkDiscoveryMount,
  checkNoMovedWords,
  isDiscoveryMount,
} from './manifest-deprecations.ts'

import type { MigratingShard } from './format-migrations.ts'

const LOADOUT = { weapons: ['bow'], tools: [], start: ['bow'] }
const AUDIO = { ambience: 'forest', score: 'calm' }

/** A Driftwood r9-shaped file: every moved word in the manifest, default sections. */
function older(): MigratingShard {
  return {
    index: {},
    sections: new Map<string, unknown>([
      [
        'ui/level',
        {
          manifest: {
            slug: 'driftwood-isle',
            spawn: { x: 12, z: -4, yaw: 1.5 },
            loadout: LOADOUT,
            weapon: 'crossbow',
            audio: AUDIO,
            species: ['crab'],
            spawns: [
              { kind: 'crab', count: 3, canopy: false, trailBand: [0, 1] },
            ],
            faunaTuning: { crab: { sightRange: 9 } },
          },
        },
      ],
      ['world/spawn', { spawn: { x: 0, y: 2, z: 0, yaw: 0 } }],
      ['combat/items', { items: { rows: [], loadout: {} } }],
      ['audio/audio', { audio: { loops: [] } }],
    ]),
    mounts: new Map(),
  }
}

test('FP34: the start words move into their sections and every moved word leaves the manifest', (): void => {
  const shard = older()
  manifestMovedWords.apply(shard)
  expect(shard.sections.get('ui/level')).toEqual({
    manifest: { slug: 'driftwood-isle' },
  })
  // A manifest spawn with no height keeps the section's (a page on terrain).
  expect(shard.sections.get('world/spawn')).toEqual({
    spawn: { x: 12, y: 2, z: -4, yaw: 1.5 },
  })
  expect(shard.sections.get('combat/items')).toEqual({
    items: { rows: [], loadout: { level: LOADOUT } },
  })
  expect(shard.sections.get('audio/audio')).toEqual({
    audio: { loops: [], level: AUDIO },
  })
  expect(manifestMovedWords.to).toBe('0.1.0.6')
  expect(FORMAT_MIGRATIONS.at(-3)).toBe(manifestMovedWords)
})

test('FP34: a section own value wins over the manifest, as at the door', (): void => {
  const shard = older()
  const own = { x: 5, y: 7, z: 5, yaw: 0 }
  shard.sections.set('world/spawn', { spawn: { ...own } })
  shard.sections.set('audio/audio', {
    audio: { level: { ambience: 'sea', score: 'storm' } },
  })
  manifestMovedWords.apply(shard)
  expect(shard.sections.get('world/spawn')).toEqual({ spawn: own })
  expect(shard.sections.get('audio/audio')).toEqual({
    audio: { level: { ambience: 'sea', score: 'storm' } },
  })
})

test('FP34: a file with no level manifest, or none of the words, is unchanged', (): void => {
  const bare: MigratingShard = {
    index: {},
    sections: new Map(),
    mounts: new Map(),
  }
  manifestMovedWords.apply(bare)
  expect([...bare.sections]).toEqual([])
  const clean = older()
  clean.sections.set('ui/level', { manifest: { slug: 'sky-reach' } })
  manifestMovedWords.apply(clean)
  expect(clean.sections.get('ui/level')).toEqual({
    manifest: { slug: 'sky-reach' },
  })
  expect(clean.sections.get('world/spawn')).toEqual({
    spawn: { x: 0, y: 2, z: 0, yaw: 0 },
  })
})

test('FP34: format 0.1.0.6 refuses a moved word or the old pointer; an older file keeps them as written', (): void => {
  expect(GONE_WORDS).toEqual(['gridShardfile', ...MOVED_WORDS])
  const level = {
    manifest: { slug: 'driftwood-isle', audio: {}, gridShardfile: 'x' },
  }
  expect((): void => {
    checkNoMovedWords('0.1.0.6', level)
  }).toThrow(
    'Format 0.1.0.6 carries no manifest.gridShardfile, manifest.audio (sections/ui/level; FORMAT-PRUNE FP34)',
  )
  expect((): void => {
    checkNoMovedWords('0.1.0.5', level)
  }).not.toThrow()
  expect((): void => {
    checkNoMovedWords(2, level)
  }).not.toThrow()
  expect((): void => {
    checkNoMovedWords('0.1.0.6', { manifest: { slug: 'sky-reach' } })
  }).not.toThrow()
  expect((): void => {
    checkNoMovedWords('0.1.0.6', new Map<string, unknown>().get('ui/level'))
  }).not.toThrow()
  // The chain's copy of an older file passes the gate.
  const shard = older()
  manifestMovedWords.apply(shard)
  expect((): void => {
    checkNoMovedWords('0.1.0.6', shard.sections.get('ui/level'))
  }).not.toThrow()
})

const DISCOVERY = 'mounts/shardfiles/driftwood-isle/discovery.json'

/** An older file whose level manifest is clean and whose discovery data still carries the start words, migrated. */
function discoveryShard(): MigratingShard {
  const shard = older()
  shard.sections.set('ui/level', { manifest: { slug: 'driftwood-isle' } })
  shard.mounts.set(DISCOVERY, {
    version: 1,
    slug: 'driftwood-isle',
    data: {
      slug: 'driftwood-isle',
      spawn: { x: 3, y: 4, z: 5, yaw: 0 },
      weapon: 'sword',
      audio: AUDIO,
      sky: { day: 1 },
    },
  })
  shard.mounts.set('mounts/sky/day.json', { spawn: 'not discovery' })
  manifestMovedWords.apply(shard)
  discoveryMovedWords.apply(shard)
  return shard
}

test('FP36: the discovery data lifts its start words too and drops every moved word', (): void => {
  const shard = discoveryShard()
  expect(shard.mounts.get(DISCOVERY)).toEqual({
    version: 1,
    slug: 'driftwood-isle',
    data: { slug: 'driftwood-isle', sky: { day: 1 } },
  })
  expect(shard.mounts.get('mounts/sky/day.json')).toEqual({
    spawn: 'not discovery',
  })
  expect(shard.sections.get('world/spawn')).toEqual({
    spawn: { x: 3, y: 4, z: 5, yaw: 0 },
  })
  expect(shard.sections.get('audio/audio')).toEqual({
    audio: { loops: [], level: AUDIO },
  })
  expect(FORMAT_MIGRATIONS.at(-2)).toBe(discoveryMovedWords)
})

test('FP36: format 0.1.0.6 refuses a discovery mount carrying a moved word; older files and other mounts pass', (): void => {
  const bytes = new TextEncoder().encode(
    JSON.stringify({
      version: 1,
      data: { slug: 'x', audio: AUDIO, weapon: 'sword' },
    }),
  )
  expect((): void => {
    checkDiscoveryMount('0.1.0.6', DISCOVERY, bytes)
  }).toThrow(
    `Format 0.1.0.6 carries no data.audio, data.weapon (${DISCOVERY}; FORMAT-PRUNE FP36)`,
  )
  expect((): void => {
    checkDiscoveryMount('0.1.0.5', DISCOVERY, bytes)
  }).not.toThrow()
  expect((): void => {
    checkDiscoveryMount(
      '0.1.0.6',
      'mounts/shardfiles/driftwood-isle/other.json',
      bytes,
    )
  }).not.toThrow()
  expect((): void => {
    checkDiscoveryMount(
      '0.1.0.6',
      DISCOVERY,
      new TextEncoder().encode('{"version":1,"data":{"slug":"x"}}'),
    )
  }).not.toThrow()
})

test('FP36: only a shard discovery path is the discovery mount', (): void => {
  expect(isDiscoveryMount(DISCOVERY)).toBe(true)
  expect(isDiscoveryMount('mounts/shardfiles/../discovery.json')).toBe(false)
})
