import assert from 'node:assert/strict'
import { test } from 'node:test'

import { countRises, sourceCounts } from './one-way-counts.ts'
import { productCounts, productFacts } from './one-way-products.ts'

import type { SourceInventory } from './one-way-counts.ts'
import type { SourceFile } from './one-way-source.ts'

const files = (path: string, text: string): SourceFile => ({ path, text })
const input: SourceInventory = {
  kinds: ['boar', 'bear'],
  engine: [
    files(
      'src/client/game/systems/species/install.ts',
      'function install(register = registerSpecies) { register(a); register(b); }',
    ),
    files(
      'src/client/engine/entities/species/look.ts',
      'registeredSpecies(kind)',
    ),
    files(
      'src/shared/game/huntPattern.ts',
      'aggressive ? BOAR_TUNING : DEER_TUNING',
    ),
    files(
      'src/shared/game/manifest.ts',
      `gridShardfile; ${['first', 'Party'].join('')}`,
    ),
    files('src/shared/game/harvest.ts', 'const HARVEST = {}'),
    files(
      `${['THIRD', 'PARTY', 'NOTICES'].join('-')}.md`,
      `${['third', 'party'].join(' ')} notices`,
    ),
    files(
      'src/client/engine/core/keys.ts',
      `if (event.${['is', 'Trus', 'ted'].join('')}) armed()`,
    ),
    files('src/client/game/Inventory.ts', 'type ItemId = "boar" | "bear"'),
    files(
      'src/server/game/shardfile/hosts.ts',
      `const row = bake['bear'], other = rows["boar"]`,
    ),
    files('src/test/fixture.ts', 'gridShardfile; registerSpecies(a); "bear"'),
  ],
  sdk: [
    files(
      'packages/build/src/species.ts',
      "import '@wildshard/engine/game/systems/species/bear'; const kind = 'boar'; gridShardfile",
    ),
    files(
      'src/shards/_template/rows.json',
      '{"species":[{"id":"one","kind":"boar","variants":[]},{"id":"two","kind":"boar","variants":[],"body":{},"temperament":{}}]}',
    ),
  ],
  format: [
    files(
      'src/format/compendiumRows.ts',
      "icon: v.picklist(['antlers', 'boar', 'bear'])",
    ),
    files('src/format/minimap.ts', 'gridShardfile: v.exactOptional(text)'),
    files(
      'src/format/format-migration-prune.ts',
      "const OLD_POINTER = 'gridShardfile'",
    ),
  ],
}

function json(path: string, data: unknown): SourceFile {
  return files(path, JSON.stringify(data))
}
const product = [
  json('server/json/a.json', {
    kind: 'native-assembly',
    features: [{ host: 'commands' }, { host: 'boss.ground' }],
  }),
  json('sections/client/plan.json', {
    features: [
      { kind: 'world.surface' },
      { kind: 'view.rig' },
      { kind: 'page.life' },
      { kind: 'debug.expose' },
      { kind: 'population.creatures' },
    ],
  }),
  json('sections/actors/species.json', {
    rows: {
      species: [
        { id: 'one', kind: 'boar' },
        { id: 'two', kind: 'bear' },
      ],
      looks: [],
    },
  }),
  json('sections/look/materials.json', {
    rows: { looks: [{ species: 'one' }] },
  }),
  json('sections/actors/species-programs.json', {
    native: [{ kind: 'deer' }],
    page: [{ kind: 'wolf' }],
  }),
  json('sections/ui/level.json', {
    manifest: { spawn: {}, sky: {}, name: 'Discovery name' },
  }),
]

test('source inventory covers the audit seams without counting runtime test fixtures', (): void => {
  const counts = sourceCounts(input)
  assert.equal(counts['engine.kit-registrations'], 2)
  assert.equal(counts['engine.look-fallbacks'], 1)
  assert.equal(counts['engine.temperament-guesses'], 1)
  assert.equal(counts['engine.grid-pointer-references'], 1)
  assert.equal(counts['engine.kind-literals'], 2)
  assert.equal(counts['sdk.engine-kit-imports'], 1)
  assert.equal(counts['sdk.old-kind-source-rows'], 1)
  assert.equal(counts['engine.kind-keyed-tables'], 2)
  assert.equal(counts['format.kind-keyed-tables'], 1)
})

test('a migration chain step names the old pointer it rewrites without counting', (): void => {
  assert.equal(sourceCounts(input)['format.grid-pointer-references'], 1)
})

test('a chain step test names the old trust words it rewrites without counting; other format tests count', (): void => {
  const old = `trust: '${['first', 'party'].join('-')}'`
  const counts = sourceCounts({
    ...input,
    format: [
      files('src/format/format-migration-prune.test.ts', old),
      files('src/format/deprecations.test.ts', old),
      files('src/tools/reupload.test.ts', old),
    ],
  })
  assert.equal(counts['format.retired-vocabulary'], 1)
})

test('each planted pointer or vocabulary growth fails only its own counter', (): void => {
  const baseline = sourceCounts(input)
  const pointer = sourceCounts({
    ...input,
    engine: [...input.engine, files('src/extra.ts', 'gridShardfile')],
  })
  const wording = sourceCounts({
    ...input,
    engine: [...input.engine, files('docs/extra.md', ['trus', 'ted'].join(''))],
  })
  assert.deepEqual(countRises(baseline, pointer), [
    'engine.grid-pointer-references: 1 -> 2',
  ])
  assert.deepEqual(countRises(baseline, wording), [
    'engine.retired-vocabulary: 1 -> 2',
  ])
  assert.deepEqual(countRises({ existing: 2 }, { existing: 1 }), [])
  assert.deepEqual(countRises({}, { added: 1 }), ['added: 0 -> 1'])
  assert.deepEqual(countRises({}, { added: 0 }), ['added: 0 -> 0'])
})

test('product inventory reads addressed plans, explicit looks and manifest duplication', (): void => {
  const first = productFacts('one', product)
  const second = productFacts('two', [
    json('server/json/b.json', {
      kind: 'native-assembly',
      features: [{ host: 'commands' }],
    }),
  ])
  const counts = productCounts([first, second])
  assert.deepEqual(first.kinds, ['boar', 'bear', 'deer', 'wolf'])
  assert.equal(counts['products.rows-without-look'], 1)
  assert.equal(counts['products.species-program-sections'], 1)
  assert.equal(counts['products.repeated-manifest-fields'], 2)
  assert.equal(counts['products.single-shard-server-hosts'], 1)
  assert.equal(counts['products.single-shard-page-features'], 2)
})

test('FP48: server section hosts count as hosts, as native assemblies did', (): void => {
  const sectioned = productFacts('three', [
    json('sections/server/riding.json', {
      hosts: [{ host: 'riding.roster' }, { host: 'commands' }],
    }),
  ])
  const counts = productCounts([
    productFacts('two', [
      json('server/json/b.json', {
        kind: 'native-assembly',
        features: [{ host: 'commands' }],
      }),
    ]),
    sectioned,
  ])
  assert.deepEqual(sectioned.hosts, ['riding.roster', 'commands'])
  assert.equal(counts['products.single-shard-server-hosts'], 1)
})

test('duplicate appearances in one shard never masquerade as two users', (): void => {
  const counts = productCounts([
    productFacts('one', product),
    productFacts('one', product),
  ])
  assert.equal(counts['products.single-shard-server-hosts'], 2)
  assert.equal(counts['products.single-shard-page-features'], 2)
})

test('an open item identity is not a fixed kind vocabulary', (): void => {
  const generic = sourceCounts({
    ...input,
    engine: [
      files('src/client/game/Inventory.ts', 'export type ItemId = string;'),
    ],
  })
  assert.equal(generic['engine.kind-keyed-tables'], 0)
  const restricted = sourceCounts({
    ...input,
    engine: [
      files(
        'src/client/game/Inventory.ts',
        'export type ItemId = "hide" | "tusk";',
      ),
    ],
  })
  assert.equal(restricted['engine.kind-keyed-tables'], 1)
  assert.deepEqual(countRises(generic, restricted), [
    'engine.kind-keyed-tables: 0 -> 1',
  ])
})

/** A product whose level manifest holds only this minimap. */
function mapProduct(minimap: unknown): ReturnType<typeof productFacts> {
  return productFacts('map', [
    json('sections/ui/level.json', { manifest: { minimap } }),
  ])
}

test('FP47: minimap counts as repeated only while it carries its image', (): void => {
  assert.deepEqual(
    mapProduct({ openWater: { level: 0, deepDepth: 4 } }).manifestFields,
    [],
  )
  assert.deepEqual(mapProduct({ image: '/assets/map.png' }).manifestFields, [
    'minimap',
  ])
})
