// ONE-FORMAT OF19c0b: a native runtime plan whose boss moved to a declared encounter keeps no owner row. Its keeper then
// stands no boss, and it has no owner inputs to order.
import { expect, test } from 'vitest';
import { nativeRuntimeActorIds, parseNativeRuntimePlan } from './nativeRuntimePlan.ts';

const plan = (rows: Record<string, unknown> = {}, extra: Record<string, unknown> = {}): unknown => ({ kind: 'held-melee', baked: {}, ...extra,
  recipe: { terrain: 'none', ground: { size: 64, height: 0 }, player: { speed: 5 },
    runtime: { weapon: { id: 'whip' }, quest: { spots: 'metadata' } },
    population: { sources: 'actors', seed: 'declared',
      rows: { program: { species: [], strikes: [] }, step: 'homes', seed: 1, homes: [], attackers: null, think: 'legacy', admission: 'prepare', ...rows } } } });

test('a plan with no owner row parses with no owner inputs, and its keeper names only its homes', () => {
  const parsed = parseNativeRuntimePlan(plan({ homes: [{ id: 'ray', kind: 'ray', at: [0, 0], yaw: 0, respawn: 30 }] }));
  expect(parsed.recipe.population.owner).toBeUndefined();
  expect(parsed.ownerInputs).toEqual([]);
  expect(nativeRuntimeActorIds(parsed)).toEqual(['ray']);
});

test('a keeper boss with no owner row, or owner inputs with no owner, refuse', () => {
  expect(() => parseNativeRuntimePlan(plan({ boss: { id: 'boss', kind: 'matriarch', at: [0, 0], yaw: 0 } }))).toThrow(/needs its owner row/u);
  expect(() => parseNativeRuntimePlan(plan({}, { ownerInputs: ['lit'] }))).toThrow(/owner input order/u);
});
