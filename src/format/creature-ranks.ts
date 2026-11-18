/** A spawn row's rank (ONE-FORMAT OF28, Q-CC33 (a)): a stronger version of the
 * same creature, scaled by fixed multipliers. The engine applies them; a shard
 * only names the rank. Pine's and Nalati's elites move onto these (OF33). */
type CreatureRank = 'veteran' | 'elite' | 'champion' | 'legendary'

interface CreatureRankPolicy {
  /** Maximum hit points. */
  readonly hp: number
  /** Every strike's damage. */
  readonly damage: number
  /** Body scale, on top of the spawn's own scale and its size class. */
  readonly size: number
  /** Loot rolls. */
  readonly loot: number
}

const CREATURE_RANK_NAMES: readonly CreatureRank[] = [
  'veteran',
  'elite',
  'champion',
  'legendary',
]
const CREATURE_RANKS: Readonly<Record<CreatureRank, CreatureRankPolicy>> = {
  veteran: { hp: 2, damage: 1.25, size: 1.1, loot: 2 },
  elite: { hp: 4, damage: 1.5, size: 1.2, loot: 3 },
  champion: { hp: 10, damage: 2, size: 1.35, loot: 5 },
  legendary: { hp: 25, damage: 2.5, size: 1.5, loot: 8 },
}
const UNRANKED: CreatureRankPolicy = { hp: 1, damage: 1, size: 1, loot: 1 }

/** The multipliers for a spawn row's rank; an unranked row keeps its own numbers. */
function creatureRank(rank?: CreatureRank): CreatureRankPolicy {
  return rank === undefined ? UNRANKED : CREATURE_RANKS[rank]
}

export { CREATURE_RANK_NAMES, CREATURE_RANKS, creatureRank }
export type { CreatureRank, CreatureRankPolicy }
