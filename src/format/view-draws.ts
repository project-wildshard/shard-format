import { CONTENT_CAPS } from './contentBounds.ts'

const PHONE_VIEW = 150
const DESKTOP_VIEW = 400
const FINE = 0
const X_AXIS = 0
const Z_AXIS = 2
const HALF = 2
const SQUARE = 2
const NONE = 0

/** The fields of a shardfile tile a view's draws read. */
interface ViewBox {
  readonly max: readonly number[]
  readonly min: readonly number[]
}
interface ViewTile {
  readonly bounds: ViewBox
  readonly drawBounds?: ViewBox | undefined
  readonly draws: number
  readonly lod: number
}

/**
 * SHARD-SOURCE AP8: one view's whole-frame draws per tier (shadow and post
 * passes included; the phone figure is the engine's EP10 limit). Engines draw
 * a material once across resident tiles, so a view's draws are capped, not a
 * tile's.
 */
const VIEW_DRAWS: { readonly phone: number; readonly desktop: number } =
  Object.freeze({ desktop: DESKTOP_VIEW, phone: PHONE_VIEW })

function centre(tile: ViewTile, axis: number): number {
  const box = tile.drawBounds ?? tile.bounds
  return ((box.min[axis] ?? NONE) + (box.max[axis] ?? NONE)) / HALF
}

function gap(tile: ViewTile, axis: number, at: number): number {
  const box = tile.drawBounds ?? tile.bounds
  return Math.max(
    (box.min[axis] ?? NONE) - at,
    at - (box.max[axis] ?? NONE),
    NONE,
  )
}

function isNear(tile: ViewTile, xAt: number, zAt: number): boolean {
  const reach =
    gap(tile, X_AXIS, xAt) ** SQUARE + gap(tile, Z_AXIS, zAt) ** SQUARE
  return reach <= CONTENT_CAPS.nearRadius ** SQUARE
}

/**
 * The draws of a view from fine tile `from`: every fine tile near its centre
 * at its reported draws, an upper bound. A coarse tile's view counts nothing.
 */
function viewDraws(tiles: readonly ViewTile[], from: ViewTile): number {
  if (from.lod !== FINE) {
    return NONE
  }
  const xAt = centre(from, X_AXIS)
  const zAt = centre(from, Z_AXIS)
  let draws = NONE
  for (const tile of tiles) {
    if (tile.lod === FINE && isNear(tile, xAt, zAt)) {
      draws += tile.draws
    }
  }
  return draws
}

export type { ViewTile }
export { VIEW_DRAWS, viewDraws }
