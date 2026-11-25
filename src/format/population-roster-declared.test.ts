import { expect, test } from 'vitest'

import {
  NativePopulationRowsSchema,
  parseNativePopulationRows,
} from './populationRoster.ts'

// ONE-FORMAT OF30: a roster with no species programme names its declared species and carries its own hunt settings.
const base = {
  version: 1,
  environment: 'pine.habitat',
  step: 'pine.roster',
  seed: 1,
  bodyCount: 0,
  limit: 8,
  scripted: 'sidestep',
  encounter: 'king',
  poseKinds: [],
  spawn: JSON.parse('{"x":0,"z":0}') as unknown,
  fauna: [],
  identities: [],
  ordinary: {},
  reserves: [],
  homes: [],
}
const hunt = {
  limit: 8,
  player: 'origin',
  fight: { telegraphed: false, capExemptTags: [] },
  bands: { states: ['sidestep'], scripted: true },
  hit: { namespace: 'creature', tags: ['feel.blow'] },
}

test('an older roster with neither field still reads', (): void => {
  expect(parseNativePopulationRows(base).species).toBeUndefined()
})

test('a roster names its declared species, their spawn-only rows and its hunt', (): void => {
  const rows = parseNativePopulationRows({
    ...base,
    species: [
      { id: 'pine.creature.elk', spawnOnly: ['pine.elk.thrall'] },
      { id: 'pine.creature.deer' },
    ],
    hunt,
  })
  expect(rows.species).toEqual([
    { id: 'pine.creature.elk', spawnOnly: ['pine.elk.thrall'] },
    { id: 'pine.creature.deer' },
  ])
  expect(rows.hunt?.player).toBe('origin')
})

test('an unknown hunt field refuses', (): void => {
  expect((): unknown =>
    parseNativePopulationRows({ ...base, hunt: { ...hunt, extra: 1 } }),
  ).toThrow()
})

/** Paths of every v.custom inside a Valibot schema tree (a custom cannot project to JSON Schema). */
function customPaths(root: unknown): string[] {
  const seen = new Set<unknown>()
  const walk = (node: unknown, path: string): string[] => {
    if (typeof node !== 'object' || node === null || seen.has(node)) {
      return []
    }
    seen.add(node)
    const own = 'type' in node && node.type === 'custom' ? [path] : []
    return [
      ...own,
      ...Object.entries(node).flatMap(
        (entry: readonly [string, unknown]): string[] =>
          walk(entry[1], `${path}.${entry[0]}`),
      ),
    ]
  }
  return walk(root, 'roster')
}

function huntTagged(tag: string): () => unknown {
  return (): unknown =>
    parseNativePopulationRows({
      ...base,
      hunt: { ...hunt, hit: { namespace: 'creature', tags: [tag] } },
    })
}

// OF23e4: the roster's hunt holds no v.custom, so actors/roster.json still projects to JSON Schema for named JSON files
test('the roster schema holds no custom schema and its hunt tags keep their law', (): void => {
  expect(customPaths(NativePopulationRowsSchema)).toEqual([])
  expect(huntTagged('feel.blow')).not.toThrow()
  expect(huntTagged('Feel.blow')).toThrow()
  expect(huntTagged('noDot')).toThrow()
})
