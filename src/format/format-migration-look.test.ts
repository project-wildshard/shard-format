import { expect, test } from 'vitest'

import { levelLook, manifestMovedWords } from './format-migration-manifest.ts'
import { FORMAT_MIGRATIONS } from './format-migrations.ts'
import {
  LEVEL_WORDS,
  checkDiscoveryMount,
  checkNoMovedWords,
} from './manifest-deprecations.ts'

import type { MigratingShard } from './format-migrations.ts'

// FORMAT-PRUNE FP47b and FP47c: the level look and the map image leave the manifest and the discovery copy.

const DISCOVERY = 'mounts/shardfiles/driftwood-isle/discovery.json'
const SKY = { sunColor: [1, 0.97, 0.9], sunIntensity: 2.7 }
const ATMOSPHERE = { fogHeight: -20 }
const GRADE = { contrast: 0.2 }
const HORIZON = { rings: [] }
const WORDS = { sky: SKY, atmosphere: ATMOSPHERE, grade: GRADE }
const BARE = { version: 1, data: { slug: 'driftwood-isle' } }

/** A file whose level look sits in its manifest and its discovery copy, with `look/look` carrying `level`. */
function lookShard(
  manifest: Readonly<Record<string, unknown>>,
  data: Readonly<Record<string, unknown>>,
  level?: unknown,
): MigratingShard {
  return {
    index: {},
    sections: new Map<string, unknown>([
      ['ui/level', { manifest: { slug: 'driftwood-isle', ...manifest } }],
      [
        'look/look',
        { look: { families: [], ...(level === undefined ? {} : { level }) } },
      ],
    ]),
    mounts: new Map<string, unknown>([
      [DISCOVERY, { version: 1, data: { slug: 'driftwood-isle', ...data } }],
    ]),
  }
}

test('FP47b: the level look moves from the manifest into look.level and leaves the discovery copy', (): void => {
  expect(FORMAT_MIGRATIONS.at(-1)).toBe(levelLook)
  expect(levelLook.to).toBe('0.1.0.6')
  const words = { ...WORDS, horizon: HORIZON }
  const shard = lookShard(words, words)
  levelLook.apply(shard)
  expect(shard.sections.get('ui/level')).toEqual({
    manifest: { slug: 'driftwood-isle' },
  })
  expect(shard.sections.get('look/look')).toEqual({
    look: { families: [], level: words },
  })
  expect(shard.mounts.get(DISCOVERY)).toEqual(BARE)
})

test('FP47b: an open plot (the look only in discovery) gives its discovery copy to look.level', (): void => {
  const plot = lookShard({}, WORDS)
  levelLook.apply(plot)
  expect(plot.sections.get('look/look')).toEqual({
    look: { families: [], level: WORDS },
  })
  expect(plot.mounts.get(DISCOVERY)).toEqual(BARE)
})

test('FP47b: a look.level of its own (built since OF9b2) stands, and the discovery copy only leaves', (): void => {
  const own = { sky: { sunIntensity: 3 }, atmosphere: ATMOSPHERE, grade: GRADE }
  const built = lookShard({}, WORDS, own)
  levelLook.apply(built)
  expect(built.sections.get('look/look')).toEqual({
    look: { families: [], level: own },
  })
  expect(built.mounts.get(DISCOVERY)).toEqual(BARE)
})

test('FP47b: a partial look has no level to give, and only leaves', (): void => {
  const partial = lookShard({}, { sky: SKY })
  levelLook.apply(partial)
  expect(partial.sections.get('look/look')).toEqual({ look: { families: [] } })
  expect(partial.mounts.get(DISCOVERY)).toEqual(BARE)
})

test('FP47b: format 0.1.0.6 refuses the level look in ui/level; 0.1.0.5 keeps it', (): void => {
  expect(LEVEL_WORDS).toEqual(['sky', 'atmosphere', 'grade', 'horizon'])
  const level = { manifest: { slug: 'driftwood-isle', sky: SKY, grade: GRADE } }
  expect((): void => {
    checkNoMovedWords('0.1.0.6', level)
  }).toThrow(
    'Format 0.1.0.6 carries no manifest.sky, manifest.grade (sections/ui/level; FORMAT-PRUNE FP47b)',
  )
  expect((): void => {
    checkNoMovedWords('0.1.0.5', level)
  }).not.toThrow()
})

test('FP47b: format 0.1.0.6 refuses the level look in the discovery mount; the chain copy passes', (): void => {
  const bytes = new TextEncoder().encode(
    JSON.stringify({ version: 1, data: { slug: 'x', atmosphere: ATMOSPHERE } }),
  )
  expect((): void => {
    checkDiscoveryMount('0.1.0.6', DISCOVERY, bytes)
  }).toThrow(
    `Format 0.1.0.6 carries no data.atmosphere (${DISCOVERY}; FORMAT-PRUNE FP47b)`,
  )
  expect((): void => {
    checkDiscoveryMount('0.1.0.5', DISCOVERY, bytes)
  }).not.toThrow()
  const shard = lookShard(WORDS, { sky: SKY })
  levelLook.apply(shard)
  expect((): void => {
    checkNoMovedWords('0.1.0.6', shard.sections.get('ui/level'))
  }).not.toThrow()
})

test('FP47c: format 0.1.0.6 refuses the level manifest map image; 0.1.0.5 keeps it', (): void => {
  const image = { manifest: { slug: 'x', minimap: { image: 'y' } } }
  expect((): void => {
    checkNoMovedWords('0.1.0.6', image)
  }).toThrow(
    'Format 0.1.0.6 carries no manifest.minimap.image (sections/ui/level; FORMAT-PRUNE FP34)',
  )
  expect((): void => {
    checkNoMovedWords('0.1.0.5', image)
  }).not.toThrow()
})

test('FP47c: the map image leaves with the moved words and the water level stays', (): void => {
  const minimap = { image: 'data:image/svg+xml,x', openWater: { level: 0 } }
  const shard = lookShard({ weapon: 'crossbow', minimap }, {})
  manifestMovedWords.apply(shard)
  expect(shard.sections.get('ui/level')).toEqual({
    manifest: { slug: 'driftwood-isle', minimap: { openWater: { level: 0 } } },
  })
  expect((): void => {
    checkNoMovedWords('0.1.0.6', shard.sections.get('ui/level'))
  }).not.toThrow()
})
