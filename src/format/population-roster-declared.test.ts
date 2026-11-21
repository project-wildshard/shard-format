import { describe, expect, test } from 'vitest';
import { parseNativePopulationRows } from './populationRoster.ts';

// ONE-FORMAT OF30: a roster with no species programme names its declared species and carries its own hunt settings.
const base = { version: 1, environment: 'pine.habitat', step: 'pine.roster', seed: 1, bodyCount: 0, limit: 8, scripted: 'sidestep',
  encounter: 'king', poseKinds: [], spawn: { x: 0, z: 0 }, fauna: [], identities: [], ordinary: {}, reserves: [], homes: [] } as const;
const hunt = { limit: 8, player: 'origin', fight: { telegraphed: false, capExemptTags: [] },
  bands: { states: ['sidestep'], scripted: true, legacyKinds: [] }, hit: { namespace: 'creature', tags: ['feel.blow'] } } as const;

describe('native population roster rows', () => {
  test('an older roster with neither field still reads', () => {
    expect(parseNativePopulationRows(base).species).toBeUndefined();
  });
  test('a roster names its declared species, their spawn-only rows and its hunt', () => {
    const rows = parseNativePopulationRows({ ...base, species: [{ id: 'pine.creature.elk', spawnOnly: ['pine.elk.thrall'] }, { id: 'pine.creature.deer' }], hunt });
    expect(rows.species?.map(row => row.id)).toEqual(['pine.creature.elk', 'pine.creature.deer']);
    expect(rows.hunt?.player).toBe('origin');
  });
  test('an unknown hunt field refuses', () => {
    expect(() => parseNativePopulationRows({ ...base, hunt: { ...hunt, extra: 1 } })).toThrow();
  });
});
