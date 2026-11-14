import { expect, test } from 'vitest'

import { VIEW_DRAWS, viewDraws } from './view-draws.ts'

import type { ViewTile } from './view-draws.ts'

const PITCH = 62.5
const ORIGIN = 250
const HEIGHT = 10
const COARSE = 1
const HUT_DRAWS = 74

interface TileRow {
  readonly draws: number
  readonly lod: number
  readonly xAt: number
  readonly zAt: number
}

function tile(row: TileRow): ViewTile {
  return {
    bounds: {
      max: [
        (row.xAt + 1) * PITCH - ORIGIN,
        HEIGHT,
        (row.zAt + 1) * PITCH - ORIGIN,
      ],
      min: [row.xAt * PITCH - ORIGIN, 0, row.zAt * PITCH - ORIGIN],
    },
    draws: row.draws,
    lod: row.lod,
  }
}

test('AP8: a view sums the fine tiles near it, not one tile against the old 8-draw cap', (): void => {
  const hut = tile({ draws: 43, lod: 0, xAt: 3, zAt: 3 })
  const tiles = [
    hut,
    tile({ draws: 18, lod: 0, xAt: 3, zAt: 4 }),
    tile({ draws: 13, lod: 0, xAt: 4, zAt: 3 }),
    tile({ draws: 90, lod: 0, xAt: 7, zAt: 7 }),
    tile({ draws: 40, lod: COARSE, xAt: 1, zAt: 1 }),
  ]
  expect(viewDraws(tiles, hut)).toBe(HUT_DRAWS)
  expect(viewDraws(tiles, hut)).toBeLessThanOrEqual(VIEW_DRAWS.phone)
  expect(VIEW_DRAWS).toEqual({ desktop: 400, phone: 150 })
})
