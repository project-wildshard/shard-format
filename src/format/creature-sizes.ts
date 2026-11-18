import { creatureRank } from './creature-ranks.ts'

import type { CreatureBody, CreatureSize } from './creature-layers.ts'
import type { CreatureRank } from './creature-ranks.ts'

interface CreatureSizePolicy {
  readonly scale: number
  readonly stride: number
  readonly aggro: number
  readonly cellWeight: number
  readonly maxHeight?: number
}
const GIANT_HEIGHT = 15
const DEFAULT_SCALE = 1
const BODY_HEIGHT_FACTOR = 2
const MAX_VARIANT_SCALE = 1
/** Medium preserves the authored model units. Free body and spawn scales apply
 * after the class; stride/aggro are independent multipliers, not extra geometry. */
const CREATURE_SIZES: Readonly<Record<CreatureSize, CreatureSizePolicy>> = {
  tiny: { scale: 0.25, stride: 0.5, aggro: 0.5, cellWeight: 0.25 },
  small: { scale: 0.5, stride: 0.75, aggro: 0.75, cellWeight: 0.5 },
  medium: { scale: 1, stride: 1, aggro: 1, cellWeight: 1 },
  large: { scale: 2, stride: 1.5, aggro: 1.5, cellWeight: 4 },
  giant: {
    scale: 4,
    stride: 2,
    aggro: 2,
    cellWeight: 16,
    maxHeight: GIANT_HEIGHT,
  },
}
type SizeBody = Pick<CreatureBody, 'size' | 'scale'>
interface CreatureDimensions {
  readonly bodyY: number
  readonly bodyRadius: number
  readonly headRadius: number
}
interface SizedSpecies {
  readonly id: string
  readonly body?: SizeBody
  readonly dims: CreatureDimensions
  readonly variants: readonly { readonly scale: readonly [number, number] }[]
}
interface SizedSpawn {
  readonly id: string
  readonly species: string
  readonly scale: number
  readonly rank?: CreatureRank
}

function creatureScale(
  body: SizeBody | undefined,
  spawnScale: number = DEFAULT_SCALE,
): number {
  return (
    spawnScale *
    (body === undefined
      ? DEFAULT_SCALE
      : CREATURE_SIZES[body.size].scale * body.scale)
  )
}
/** The declared dimensions' conservative upright envelope. Rig/mesh admission
 * checks its actual transformed bounds separately; dimensions cannot waive it. */
function creatureHeight(
  body: SizeBody,
  dims: CreatureDimensions,
  spawnScale: number,
): number {
  const modelHeight = Math.max(
    dims.bodyY * BODY_HEIGHT_FACTOR + dims.headRadius,
    dims.bodyY + dims.bodyRadius,
  )
  return modelHeight * creatureScale(body, spawnScale)
}
function speciesSizeRules(
  row: SizedSpecies,
  spawns: readonly SizedSpawn[],
): string[] {
  const { body } = row
  if (body === undefined) {
    return []
  }
  const cap = CREATURE_SIZES[body.size].maxHeight
  if (cap === undefined) {
    return []
  }
  const oversized = row.variants.some(
    (variant): boolean =>
      creatureHeight(body, row.dims, variant.scale[MAX_VARIANT_SCALE]) > cap,
  )
  const errors = oversized ? [`species ${row.id}: giant exceeds ${cap} m`] : []
  return [
    ...errors,
    ...spawns.flatMap((spawn): string[] =>
      spawn.species === row.id &&
      creatureHeight(
        body,
        row.dims,
        spawn.scale * creatureRank(spawn.rank).size,
      ) > cap
        ? [`spawn ${spawn.id}: giant exceeds ${cap} m`]
        : [],
    ),
  ]
}
function creatureSizeRules(
  species: readonly SizedSpecies[],
  spawns: readonly SizedSpawn[] = [],
): string[] {
  return species.flatMap((row): string[] => speciesSizeRules(row, spawns))
}

export { CREATURE_SIZES, creatureScale, creatureHeight, creatureSizeRules }
export type { CreatureSizePolicy }
