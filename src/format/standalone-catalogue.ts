import {
  array,
  check,
  exactOptional,
  finite,
  integer,
  literal,
  minValue,
  number,
  picklist,
  pipe,
  strictObject,
  string,
  tuple,
} from 'valibot'

import {
  GridCatalogueSchema,
  GridIdSchema,
  uniquePlaces,
} from './grid-catalogue.ts'
import {
  RevisionNumberSchema,
  ShardSlugSchema,
  ShardfileHashSchema,
} from './upload-wire.ts'

import type { GridCatalogue, GridCatalogueInput } from './grid-catalogue.ts'
import type { GenericSchema } from 'valibot'

// `catalogue.json` (J61, J138): what a standalone build bakes, so that a flip
// reaches players with a deploy and no client code (C3). `grid` and
// `placements` are `src/game/shared/grid/singleplayer.json` today, field for
// field. A cell's `slug` keeps the authored spelling, so `_template` stays
// `_template` although its product's `identity.slug` cannot start with an
// underscore: `shardSlugOf` is the one mapping, as `firstPartyInstance` does.

const FORMAT_VERSION = 0
const MIN_SIZE = 1

/** Where a shard sits when it runs alone, on its own page. */
interface SoloPlacement {
  readonly instance: string
  readonly slug: string
  readonly cell: [number, number]
  readonly size: [number, number, number]
  /** Its place in the title's list (`ShardManifest.order`). */
  readonly order?: number
  /** `hidden` keeps it off the title's list (`ShardManifest.status`). */
  readonly status?: string
}

/** The grid data api-server stores: singleplayer.json's shape. */
interface GridDocument<Grid = GridCatalogue> {
  readonly version: typeof FORMAT_VERSION
  readonly placements: SoloPlacement[]
  readonly grid: Grid
}

type GridDocumentInput = GridDocument<GridCatalogueInput>

/** A shard's head at the catalogue's stage. */
interface CatalogueHead {
  readonly slug: string
  readonly name: string
  readonly revision: number
  /** The shardfile's hash: what names its cooked packs (J83). */
  readonly hash: string
}

interface CatalogueHeads {
  /** Live heads; for a preview build, preview heads over them (J63). */
  readonly stage: 'live' | 'preview'
  readonly shards: CatalogueHead[]
  /** Placed slugs with no head at this stage; a release needs none. */
  readonly missing: string[]
}

type StandaloneCatalogue = GridDocument & CatalogueHeads
type StandaloneCatalogueInput = GridDocumentInput & CatalogueHeads

const whole = pipe(number(), integer())
const size = pipe(number(), finite(), minValue(MIN_SIZE))

const SoloPlacementSchema: GenericSchema<SoloPlacement> = strictObject({
  instance: GridIdSchema,
  slug: GridIdSchema,
  cell: tuple([whole, whole]),
  size: tuple([size, size, size]),
  order: exactOptional(whole),
  status: exactOptional(string()),
})

const placements = pipe(
  array(SoloPlacementSchema),
  check(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's check takes the schema's own type
    (rows: SoloPlacement[]): boolean => uniquePlaces(rows),
    'one solo placement per instance and per cell',
  ),
)

const CatalogueHeadSchema: GenericSchema<CatalogueHead> = strictObject({
  slug: ShardSlugSchema,
  name: string(),
  revision: RevisionNumberSchema,
  hash: ShardfileHashSchema,
})

const GridDocumentSchema: GenericSchema<GridDocumentInput, GridDocument> =
  strictObject({
    version: literal(FORMAT_VERSION),
    placements,
    grid: GridCatalogueSchema,
  })

const StandaloneCatalogueSchema: GenericSchema<
  StandaloneCatalogueInput,
  StandaloneCatalogue
> = strictObject({
  version: literal(FORMAT_VERSION),
  stage: picklist(['live', 'preview']),
  placements,
  grid: GridCatalogueSchema,
  shards: array(CatalogueHeadSchema),
  missing: array(GridIdSchema),
})

/** The `identity.slug` of the product a cell or placement names. */
function shardSlugOf(slug: string): string {
  return slug.replace(/^_/u, '')
}

export {
  GridDocumentSchema,
  StandaloneCatalogueSchema,
  shardSlugOf,
  type CatalogueHead,
  type GridDocument,
  type GridDocumentInput,
  type SoloPlacement,
  type StandaloneCatalogue,
  type StandaloneCatalogueInput,
}
