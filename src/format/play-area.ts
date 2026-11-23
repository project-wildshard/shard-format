/* oxlint-disable id-length, import/exports-last, import/group-exports, max-params, max-statements, no-magic-numbers -- x0/z1/x/z are the format's own bound field names and outerFloor keeps engine's (rows, floor, x, z) shape (SHARD-COMPAT PR6c) */
// SHARD-COMPAT PR6c (J487): a shard's play area (its x/z box and the fall floor at each spot) from the manifest's bounds
// under the `client/plan` rows that override them, so the page, the room and the MMO server read one rule without engine
// code. Moved from engine `src/shared/game/shardfile/playArea.ts` (SERVER-PARITY SS6): `player.enter` replaces the
// authored bounds (Sky Reach: floor -8, 250 m each way), `world.runtime-hooks` keeps the authored floor near the middle
// and drops it past a radius (Nine Dragon: -20 past 200 m), and the hooks win when a shard has both.

/** A rectangle and its fall floor, as a manifest or `player.enter` declares it. */
export interface PlayBounds {
  readonly x0: number
  readonly x1: number
  readonly z0: number
  readonly z1: number
  readonly floor: number
}

/** A `world.runtime-hooks` play area: its x/z, and the floor past `maxAbsXZ` from the origin. */
export interface RuntimeBoundsRows {
  readonly x: readonly [number, number]
  readonly z: readonly [number, number]
  readonly outer: { readonly maxAbsXZ: number; readonly floor: number }
}

/** One `client/plan` feature row, as far as the play area reads it. */
export interface PlayAreaFeature {
  readonly kind: string
  readonly bounds?: PlayBounds | RuntimeBoundsRows
}

/** Where a player may stand in a shard: an x/z box, and the fall floor at each spot in it. */
export interface PlayArea {
  readonly x0: number
  readonly x1: number
  readonly z0: number
  readonly z1: number
  readonly floorAt: (x: number, z: number) => number
}

/** The floor at (x, z) under a runtime-hooks area: the authored floor inside `maxAbsXZ`, the outer floor past it. */
export function outerFloor(
  rows: RuntimeBoundsRows,
  authored: number,
  x: number,
  z: number,
): number {
  return Math.max(Math.abs(x), Math.abs(z)) > rows.outer.maxAbsXZ
    ? rows.outer.floor
    : authored
}

const isRuntime = (
  bounds: PlayBounds | RuntimeBoundsRows,
): bounds is RuntimeBoundsRows => 'outer' in bounds

/** The play area the page selects for `authored` (the manifest's bounds) under the shard's `client/plan` features, or
 *  none. The runtime hooks install after `player.enter`, so theirs wins when a shard has both. */
export function declaredPlayArea(
  authored: PlayBounds | undefined,
  features: readonly PlayAreaFeature[],
): PlayArea | undefined {
  let enter: PlayBounds | undefined = undefined
  let hooks: RuntimeBoundsRows | undefined = undefined
  for (const { kind, bounds } of features) {
    if (bounds !== undefined && kind === 'player.enter' && !isRuntime(bounds)) {
      enter = bounds
    } else if (
      bounds !== undefined &&
      kind === 'world.runtime-hooks' &&
      isRuntime(bounds)
    ) {
      hooks = bounds
    }
  }
  if (hooks !== undefined) {
    // The page's hook keeps no area for a level that authors none (`runtimeLevelBounds`).
    if (authored === undefined) {
      return undefined
    }
    const rows = hooks
    const { floor } = authored
    return {
      x0: rows.x[0],
      x1: rows.x[1],
      z0: rows.z[0],
      z1: rows.z[1],
      floorAt: (x: number, z: number): number => outerFloor(rows, floor, x, z),
    }
  }
  const bounds = enter ?? authored
  if (bounds === undefined) {
    return undefined
  }
  const { x0, x1, z0, z1, floor } = bounds
  return { x0, x1, z0, z1, floorAt: (): number => floor }
}
