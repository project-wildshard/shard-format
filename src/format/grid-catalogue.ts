// oxlint-disable eslint/id-length -- x, y and z are the axes' names
import {
  array,
  check,
  exactOptional,
  finite,
  integer,
  literal,
  maxLength,
  maxValue,
  minLength,
  minValue,
  number,
  optional,
  pipe,
  regex,
  strictObject,
  string,
  tuple,
} from 'valibot'

import { AccentSchema } from './accent.ts'
import { CONTENT_CAPS, GRID_CELL_COUNT, GRID_RADIUS } from './contentBounds.ts'

import type { AccentId } from './accent.ts'
import type { GenericSchema, InferOutput } from 'valibot'

// The shard grid's placement data: singleplayer's
// `src/game/shared/grid/catalogue.ts`, rows for rows, moved here because
// api-server must admit what the client admits and depends only on this
// repo (J27). Singleplayer keeps its copy until C3 bumps its pin.

const CELL_LOCAL_LIMIT = 250
const MAX_MARKS = 8
const MAX_PLOTS = 8
const MIN_PLOT_HALF = 16
const MAX_PLOT_HALF = 40
const MIN_MARK_SIZE = 0.5
const MAX_MARK_SIZE = 12
const MIN_EDGE_HEIGHT = 0.5
const MAX_EDGE_HEIGHT = 7
const MAX_LAYOUT_SEED = 2_147_483_647
const ZERO = 0
const ONE = 1
const SLUG_OR_INSTANCE = /^_?[a-z0-9]+(?:-[a-z0-9]+)*$/u

/** A `slug` or `instance`. Authored, so `_template` keeps its underscore. */
const GridIdSchema: GenericSchema<string> = pipe(
  string(),
  regex(SLUG_OR_INSTANCE),
)

const signed = pipe(
  number(),
  integer(),
  minValue(-GRID_RADIUS),
  maxValue(GRID_RADIUS),
)
const local = pipe(
  number(),
  finite(),
  minValue(-CELL_LOCAL_LIMIT),
  maxValue(CELL_LOCAL_LIMIT),
)
const height = pipe(
  number(),
  finite(),
  minValue(ZERO),
  maxValue(CELL_LOCAL_LIMIT),
)
const anyAngle = pipe(number(), finite())
const distance = pipe(number(), finite(), minValue(ZERO))
const channel = pipe(number(), finite(), minValue(ZERO), maxValue(ONE))
const colour = tuple([channel, channel, channel])
const markSize = pipe(
  number(),
  minValue(MIN_MARK_SIZE),
  maxValue(MAX_MARK_SIZE),
)
const plotHalf = pipe(
  number(),
  finite(),
  minValue(MIN_PLOT_HALF),
  maxValue(MAX_PLOT_HALF),
)
const layoutSeed = pipe(
  number(),
  integer(),
  minValue(ZERO),
  maxValue(MAX_LAYOUT_SEED),
)
const edgeHeight = pipe(
  number(),
  finite(),
  minValue(MIN_EDGE_HEIGHT),
  maxValue(MAX_EDGE_HEIGHT),
)

/** A number panel on a copy's structures, facing `yaw` (0 = +z). */
interface CopyMark {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly yaw: number
  readonly size: number
}

/** A clear, level square the product leaves, filled by the copy's layout. */
interface CopyPlot {
  readonly x: number
  readonly z: number
  readonly half: number
}

interface CopyLayout {
  readonly seed: number
  readonly plots: CopyPlot[]
}

/** A shared product's copy identity, data only. */
interface CopyIdentity<Accent> {
  readonly accent: Accent
  readonly marks: CopyMark[]
  readonly layout?: CopyLayout | undefined
}

interface GridEdgeLook {
  readonly height: number
}

interface GridCell<Accent = AccentId> {
  readonly instance: string
  readonly slug: string
  readonly cell: [number, number]
  readonly identity?: CopyIdentity<Accent> | undefined
  readonly edgeLook?: GridEdgeLook
  readonly speedClass?: 'road'
}

/** The sea past the grid's edge. */
interface EmptyNeighbour {
  readonly kind: 'sea'
  readonly level: typeof ZERO
  readonly edgeColour: [number, number, number]
  readonly fog: {
    readonly colour: [number, number, number]
    readonly near: number
    readonly far: number
  }
}

interface GridCatalogue<Accent = AccentId> {
  readonly version: typeof ZERO
  readonly pitch: typeof CONTENT_CAPS.pitch
  readonly cells: GridCell<Accent>[]
  readonly emptyNeighbour: EmptyNeighbour
}

type GridCatalogueInput = GridCatalogue<string>

/** A row with a stable identity on a cell. */
interface Placed {
  readonly instance: string
  readonly cell: readonly number[]
}

/** Every instance and every cell appears once. */
function uniquePlaces(rows: readonly Placed[]): boolean {
  const instances = rows.map((row: Placed): string => row.instance)
  const cells = rows.map((row: Placed): string => row.cell.join(','))
  return (
    new Set(instances).size === rows.length &&
    new Set(cells).size === rows.length
  )
}

const mark = strictObject({
  x: local,
  y: height,
  z: local,
  yaw: anyAngle,
  size: markSize,
})
const plot = strictObject({ x: local, z: local, half: plotHalf })
const layout = strictObject({
  seed: layoutSeed,
  plots: pipe(array(plot), maxLength(MAX_PLOTS)),
})
const copyIdentity = strictObject({
  accent: AccentSchema,
  marks: pipe(array(mark), maxLength(MAX_MARKS)),
  layout: optional(layout),
})
const gridCell = strictObject({
  instance: GridIdSchema,
  slug: GridIdSchema,
  cell: tuple([signed, signed]),
  identity: optional(copyIdentity),
  edgeLook: exactOptional(strictObject({ height: edgeHeight })),
  speedClass: exactOptional(literal('road')),
})
const fogShape = strictObject({ colour, near: distance, far: distance })
const fog = pipe(
  fogShape,
  check(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's check takes the schema's own type
    (row: InferOutput<typeof fogShape>): boolean => row.far > row.near,
    'increasing fog distance',
  ),
)
const emptyNeighbour = strictObject({
  kind: literal('sea'),
  level: literal(ZERO),
  edgeColour: colour,
  fog,
})
const cells = pipe(array(gridCell), minLength(ONE), maxLength(GRID_CELL_COUNT))

const gridShape = strictObject({
  version: literal(ZERO),
  pitch: literal(CONTENT_CAPS.pitch),
  cells,
  emptyNeighbour,
})

/** Placement data, independent of package content and solo coordinates. */
const GridCatalogueSchema: GenericSchema<GridCatalogueInput, GridCatalogue> =
  pipe(
    gridShape,
    check(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's check takes the schema's own type
      (grid: InferOutput<typeof gridShape>): boolean =>
        uniquePlaces(grid.cells) && grid.cells.length === GRID_CELL_COUNT,
      'unique stable instance identities and complete signed cell layout',
    ),
  )

export {
  GridCatalogueSchema,
  GridIdSchema,
  uniquePlaces,
  type EmptyNeighbour,
  type GridCatalogue,
  type GridCatalogueInput,
  type GridCell,
  type Placed,
}
