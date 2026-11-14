import { expect, test } from 'vitest';
import { VIEW_DRAWS } from './contentBounds.ts';
import { viewDraws } from './shardfile-assets.ts';
import type { Shardfile } from './shardSchema.ts';

type Tile = Shardfile['tiles'][number];
const tile = (x: number, z: number, draws: number, lod: 0 | 1 = 0): Tile =>
  ({ lod, x, z, draws, bounds: { min: [x * 62.5 - 250, 0, z * 62.5 - 250], max: [x * 62.5 - 187.5, 10, z * 62.5 - 187.5] } }) as unknown as Tile;

test('AP8: a view sums the fine tiles near it, not one tile against the old 8-draw cap', () => {
  const tiles = [tile(3, 3, 43), tile(3, 4, 18), tile(4, 3, 13), tile(7, 7, 90), tile(1, 1, 40, 1)];
  const [hut] = tiles; if (hut === undefined) throw new Error('no tile');
  expect(viewDraws(tiles, hut)).toBe(74);                 // the slice's three tiles, under a phone view's budget
  expect(viewDraws(tiles, hut)).toBeLessThanOrEqual(VIEW_DRAWS.phone);
  expect(VIEW_DRAWS).toEqual({ phone: 150, desktop: 400 });
});
