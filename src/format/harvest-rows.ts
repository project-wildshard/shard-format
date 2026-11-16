import {
  array,
  check,
  exactOptional,
  integer,
  maxLength,
  maxValue,
  minLength,
  minValue,
  number,
  pipe,
  regex,
  strictObject,
  string,
} from 'valibot'

import type { GenericSchema } from 'valibot'

/** Ordered deterministic drops; an omitted selector matches every admitted variant. */
interface HarvestDrop {
  item: string
  count: number
  variants?: string[]
}

const MAX_ID_LENGTH = 128
const MAX_ITEMS = 64
const MIN_COUNT = 1
const EMPTY_TOTAL = 0
const identifier = pipe(
  string(),
  regex(/^[a-z][a-zA-Z0-9.:-]*$/u),
  maxLength(MAX_ID_LENGTH),
)
const variants = pipe(
  array(identifier),
  minLength(MIN_COUNT),
  maxLength(MAX_ITEMS),
  check<string[], 'unique harvest variants'>(
    (rows: readonly string[]): boolean => new Set(rows).size === rows.length,
    'unique harvest variants',
  ),
)
const drop = strictObject({
  item: identifier,
  count: pipe(number(), integer(), minValue(MIN_COUNT), maxValue(MAX_ITEMS)),
  variants: exactOptional(variants),
})

/** At most 64 item units across a species' entire declaration, even before selectors reduce it. */
const HarvestDropsSchema: GenericSchema<HarvestDrop[], HarvestDrop[]> = pipe(
  array(drop),
  maxLength(MAX_ITEMS),
  check<HarvestDrop[], 'harvest item budget'>(
    (rows: readonly Readonly<{ count: number }>[]): boolean =>
      rows.reduce(
        (total: number, row: Readonly<{ count: number }>): number =>
          total + row.count,
        EMPTY_TOTAL,
      ) <= MAX_ITEMS,
    'harvest item budget',
  ),
)

interface HarvestSpecies {
  readonly id: string
  readonly variants: readonly Readonly<{ id: string }>[]
  readonly spawnOnly?: readonly Readonly<{ id: string }>[]
  readonly harvest?: readonly Readonly<{
    item: string
    count: number
    variants?: readonly string[]
  }>[]
}

/** Row admission checks variants; full shard admission additionally checks the pack catalogue. */
function harvestSpeciesRules(
  species: readonly HarvestSpecies[],
  items?: ReadonlySet<string>,
): string[] {
  const errors: string[] = []
  for (const row of species) {
    const known = new Set(
      [...row.variants, ...(row.spawnOnly ?? [])].map(
        (variant: Readonly<{ id: string }>): string => variant.id,
      ),
    )
    for (const entry of row.harvest ?? []) {
      if (items !== undefined && !items.has(entry.item)) {
        errors.push(`species ${row.id}: unknown harvest item ${entry.item}`)
      }
      for (const variant of entry.variants ?? []) {
        if (!known.has(variant)) {
          errors.push(`species ${row.id}: unknown harvest variant ${variant}`)
        }
      }
    }
  }
  return errors
}

export { HarvestDropsSchema, harvestSpeciesRules }
export type { HarvestDrop, HarvestSpecies }
