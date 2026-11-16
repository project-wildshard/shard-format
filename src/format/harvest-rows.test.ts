import { readFileSync } from 'node:fs'

import { safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { HarvestDropsSchema } from './harvest-rows.ts'
import { assembleOutputShardfile, parseOutputIndex } from './outputIndex.ts'
import { parseRows } from './rows.ts'
import { parseShardfile, shardfileRules } from './shardSchema.ts'
import { readSpecies, readSpeciesPrograms } from './speciesPrograms.ts'

import type { SpeciesRow } from './rows.ts'

const creature: SpeciesRow = {
  id: 'fixture.creature',
  kind: 'own.label',
  label: 'Fixture',
  aggressive: false,
  lockable: true,
  dims: {
    bodyY: 1,
    bodyHalfLen: 0.5,
    bodyRadius: 0.3,
    headRadius: 0.3,
    legLen: 0.5,
    feet: [],
    halfWidth: 0.4,
  },
  variants: [
    {
      id: 'plain',
      label: 'Plain',
      rarity: 'common',
      weight: 1,
      scale: [1, 1],
      hp: 25,
      mods: {
        speed: 1,
        chargeDist: 1,
        damageTaken: 1,
        chargeDamage: 0,
        relentless: false,
      },
    },
  ],
}
const drops = [{ item: 'own.trophy', count: 2, variants: ['plain'] }]
function rows(harvest: unknown): unknown {
  return {
    species: [{ ...creature, harvest }],
    weather: [],
    days: [],
    compendiums: [],
    loot: [],
    strikes: [],
    looks: [],
  }
}
function fixtureSections(
  index: Readonly<{
    sections: readonly Readonly<{ name: string; path: string }>[]
  }>,
  root: string,
): Map<string, unknown> {
  const sections = new Map<string, unknown>()
  for (const section of index.sections) {
    const path = new URL(section.path, root)
    const text = readFileSync(path, 'utf8')
    sections.set(section.name, JSON.parse(text))
  }
  return sections
}
function source(): ReturnType<typeof parseShardfile> {
  const root = new URL('../test/fixtures/cli-fixture/', import.meta.url)
  const indexPath = new URL('shard.json', root)
  const indexSource = readFileSync(indexPath, 'utf8')
  const index = parseOutputIndex(JSON.parse(indexSource))
  const sections = fixtureSections(index, root.href)
  const shard = assembleOutputShardfile(index, sections)
  shard.rows.species.push({
    ...structuredClone(creature),
    harvest: structuredClone(drops),
  })
  shard.items.catalogue = [
    ...(shard.items.catalogue ?? []),
    { id: 'own.trophy', label: 'Own trophy', icon: 'star', travels: true },
  ]
  return shard
}

test('real species rows preserve ordered drops and reject unknown variants', (): void => {
  const declared = parseRows(rows(drops))
  expect(declared.species[0]?.harvest).toEqual(drops)
  const wrong = rows([{ ...drops[0], variants: ['missing'] }])
  expect((): unknown => parseRows(wrong)).toThrow(
    'unknown harvest variant missing',
  )
  const none = parseRows(rows([]))
  expect(none.species[0]?.harvest).toEqual([])
})

test('full shard admission checks the pack catalogue as well as variant references', (): void => {
  const shard = source()
  expect(parseShardfile(shard).rows.species.at(-1)?.harvest).toEqual(drops)
  shard.items.catalogue = (shard.items.catalogue ?? []).filter(
    (row: Readonly<{ id: string }>): boolean => row.id !== 'own.trophy',
  )
  expect(shardfileRules(shard)).toContain(
    'species fixture.creature: unknown harvest item own.trophy',
  )
  expect((): unknown => parseShardfile(shard)).toThrow(
    'shardfile semantic rules',
  )
})

test('the older producer contract reads the same drop declaration, including spawn-only variants', (): void => {
  const native = {
    id: creature.id,
    kind: creature.kind,
    label: creature.label,
    variants: creature.variants,
    spawnOnly: [{ ...creature.variants[0], id: 'special' }],
    harvest: [{ item: 'own.trophy', count: 1, variants: ['special'] }],
  }
  expect(readSpecies(native).harvest).toEqual(native.harvest)
  expect(
    readSpeciesPrograms({ page: [native], native: [native] }).native[0]
      ?.harvest,
  ).toEqual(native.harvest)
  const wrong = {
    ...native,
    harvest: [{ item: 'own.trophy', count: 1, variants: ['absent'] }],
  }
  expect((): unknown => readSpecies(wrong)).toThrow('harvest variant')
  expect((): unknown =>
    readSpeciesPrograms({ page: [wrong], native: [] }),
  ).toThrow('harvest references')
})

test('drop admission bounds total delivery, ids and selectors without callbacks', (): void => {
  for (const input of [
    [{ item: 'own.trophy', count: 0 }],
    [{ item: 'own.trophy', count: 1.5 }],
    [{ item: 'own.trophy', count: 65 }],
    [
      { item: 'own.trophy', count: 64 },
      { item: 'other.trophy', count: 1 },
    ],
    [{ item: '../unsafe', count: 1 }],
    [{ item: 'own.trophy', count: 1, variants: [] }],
    [{ item: 'own.trophy', count: 1, variants: ['plain', 'plain'] }],
    [{ item: 'own.trophy', count: 1, when: (): boolean => true }],
  ]) {
    expect(safeParse(HarvestDropsSchema, input).success).toBe(false)
  }
  expect(
    safeParse(HarvestDropsSchema, [{ item: 'own.trophy', count: 64 }]).success,
  ).toBe(true)
})
