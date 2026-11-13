import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import { is, parse } from 'valibot'

import { GRID_CELL_COUNT, GRID_RADIUS } from '../format/contentBounds.ts'
import { GridCatalogueSchema } from '../format/grid-catalogue.ts'
import {
  GridDocumentSchema,
  StandaloneCatalogueSchema,
  shardSlugOf,
} from '../format/standalone-catalogue.ts'

import type { GridCatalogueInput, GridCell } from '../format/grid-catalogue.ts'

const J305_RADIUS = 2
const FULL_LINES = [-3, -2, -1, 0, 1, 2, 3]
// J305's 25 cells and 27 solo placements, as api.wildshard.io's
// production catalogue.json served them on 2026-11-13 (J314: they never move).
const J305_TEXT = await readFile(
  new URL('fixtures/j305-grid.json', import.meta.url),
  'utf8',
)

function row(column: number, line: number): GridCell<string> {
  const name = `${String(column + GRID_RADIUS)}-${String(line + GRID_RADIUS)}`
  return {
    instance: `cell-${name}`,
    slug: `shard-${name}`,
    cell: [column, line],
  }
}

function grid(): GridCatalogueInput {
  const lines = [-2, -1, 0, 1, 2]
  return {
    version: 0,
    pitch: 562.5,
    cells: lines.flatMap((column: number): GridCell<string>[] =>
      lines.map((line: number): GridCell<string> => row(column, line)),
    ),
    emptyNeighbour: {
      kind: 'sea',
      level: 0,
      edgeColour: [0.25, 0.25, 0.25],
      fog: { colour: [0.6, 0.65, 0.7], near: 60, far: 180 },
    },
  }
}

function withFirstCell(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a literal row, spread once
  cell: Readonly<Partial<GridCell<string>>>,
): GridCatalogueInput {
  const base = grid()
  const [first, ...rest] = base.cells
  assert.ok(first !== undefined)
  return { ...base, cells: [{ ...first, ...cell }, ...rest] }
}

const SOLO = {
  instance: 'template-solo',
  slug: '_template',
  cell: [0, 0] as [number, number],
  size: [500, 500, 500] as [number, number, number],
}

const HEAD = {
  slug: 'driftwood-isle',
  name: 'Driftwood Isle',
  revision: 1,
  hash: 'a'.repeat(64),
}

test('admits a complete grid', (): void => {
  assert.equal(parse(GridCatalogueSchema, grid()).cells.length, 25)
})

test('the grid is 7×7', (): void => {
  assert.deepEqual([GRID_RADIUS, GRID_CELL_COUNT], [3, 49])
})

test('admits a ring-3 cell beside empty cells', (): void => {
  const ring = withFirstCell({ cell: [0, 3] })

  assert.equal(parse(GridCatalogueSchema, ring).cells[0]?.cell[1], 3)
  assert.equal(is(GridCatalogueSchema, { ...grid(), cells: [] }), false)
})

test('admits a grid with a cell missing', (): void => {
  const short = { ...grid(), cells: grid().cells.slice(1) }

  assert.equal(parse(GridCatalogueSchema, short).cells.length, 24)
})

test('admits a full 7×7 grid', (): void => {
  const cells = FULL_LINES.flatMap((column: number): GridCell<string>[] =>
    FULL_LINES.map((line: number): GridCell<string> => row(column, line)),
  )

  assert.equal(
    parse(GridCatalogueSchema, { ...grid(), cells }).cells.length,
    49,
  )
})

test('refuses a cell at radius 4', (): void => {
  for (const cell of [
    [4, 0],
    [0, -4],
    [-4, 4],
  ] as [number, number][]) {
    assert.equal(is(GridCatalogueSchema, withFirstCell({ cell })), false)
  }
})

test("J305's 25 cells read back unchanged", (): void => {
  const document: unknown = JSON.parse(J305_TEXT)
  const parsed = parse(GridDocumentSchema, document)

  assert.equal(parsed.grid.cells.length, 25)
  for (const placed of parsed.grid.cells) {
    assert.ok(
      placed.cell.every(
        (axis: number): boolean => Math.abs(axis) <= J305_RADIUS,
      ),
    )
  }
  assert.deepEqual(parsed, document)
})

test('refuses two rows on one cell', (): void => {
  const twin = withFirstCell({ cell: [-2, -1] })

  assert.equal(is(GridCatalogueSchema, twin), false)
})

test("refuses the road's accent on a copy", (): void => {
  const road = withFirstCell({ identity: { accent: 'road', marks: [] } })

  assert.equal(is(GridCatalogueSchema, road), false)
})

test('a grid document keeps the authored slug', (): void => {
  const document = { version: 0, placements: [SOLO], grid: grid() }

  assert.equal(
    parse(GridDocumentSchema, document).placements[0]?.slug,
    '_template',
  )
  assert.equal(shardSlugOf('_template'), 'template')
  assert.equal(shardSlugOf('driftwood-isle'), 'driftwood-isle')
})

test('refuses two solo placements on one cell', (): void => {
  const twin = { ...SOLO, instance: 'twin', slug: 'other' }
  const document = { version: 0, placements: [SOLO, twin], grid: grid() }

  assert.equal(is(GridDocumentSchema, document), false)
})

test('a standalone catalogue names each head by hash', (): void => {
  const document = {
    version: 0,
    stage: 'live',
    placements: [SOLO],
    grid: grid(),
    shards: [HEAD],
    missing: ['_template'],
  }
  const badHead = { ...HEAD, hash: 'nope' }

  assert.deepEqual(parse(StandaloneCatalogueSchema, document).shards, [HEAD])
  assert.equal(
    is(StandaloneCatalogueSchema, { ...document, shards: [badHead] }),
    false,
  )
})
