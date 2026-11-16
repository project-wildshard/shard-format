import {
  array,
  boolean,
  check,
  custom,
  exactOptional,
  integer,
  maxLength,
  maxValue,
  minValue,
  number,
  pipe,
  picklist,
  regex,
  strictObject,
  string,
} from 'valibot'

import { isJsonData } from './json.ts'

import type { GenericSchema } from 'valibot'

/** A bounded contact effect, using the existing effects owner's material recipes. */
interface StrikeDebris {
  surface: 'shell' | 'wood' | 'sand'
  count: number
  atFeet: boolean
  sparks: boolean
}
/** A strike's default and optional target-species overrides, keyed by row id. */
interface StrikeDebrisPolicy {
  default: StrikeDebris
  overrides?: { target: string; effect: StrikeDebris }[]
}
const MAX_PARTICLES = 64
const MAX_OVERRIDES = 64
const MAX_ID = 128
const EMPTY = 0
const surface = picklist(['shell', 'wood', 'sand'])
const count = pipe(
  number(),
  integer(),
  minValue(EMPTY),
  maxValue(MAX_PARTICLES),
)
const effect: GenericSchema<StrikeDebris> = strictObject({
  surface,
  count,
  atFeet: boolean(),
  sparks: boolean(),
})
const target = pipe(
  string(),
  regex(/^[a-z][a-zA-Z0-9.:-]*$/u),
  maxLength(MAX_ID),
)
const override = strictObject({ target, effect })
const overrides = pipe(
  array(override),
  maxLength(MAX_OVERRIDES),
  check<NonNullable<StrikeDebrisPolicy['overrides']>, 'unique debris targets'>(
    (rows: readonly Readonly<{ target: string }>[]): boolean => {
      const identities = rows.map(
        (row: Readonly<{ target: string }>): string => row.target,
      )
      return new Set(identities).size === rows.length
    },
    'unique debris targets',
  ),
)
const policy = strictObject({
  default: effect,
  overrides: exactOptional(overrides),
})
/** Exact plain-data preflight identity for structural JSON Schema projectors. */
const StrikeDebrisJsonGuard: GenericSchema<StrikeDebrisPolicy> =
  custom<StrikeDebrisPolicy>(isJsonData, 'plain strike debris')
const StrikeDebrisSchema: GenericSchema<StrikeDebrisPolicy> = pipe(
  StrikeDebrisJsonGuard,
  policy,
)

interface DebrisReferences {
  readonly overrides?: readonly Readonly<{ target: string }>[]
}
interface DebrisSource {
  readonly debris?: DebrisReferences
}
interface StrikeDebrisCatalogue {
  readonly strikes: readonly DebrisSource[]
  readonly species: readonly Readonly<{ id: string }>[]
}
function strikeDebrisCatalogueRules(value: StrikeDebrisCatalogue): string[] {
  const identities = value.species.map(
    (row: Readonly<{ id: string }>): string => row.id,
  )
  const errors: string[] = []
  const known = new Set(identities)
  for (const strike of value.strikes) {
    for (const row of strike.debris?.overrides ?? []) {
      if (!known.has(row.target)) {
        errors.push(`Unknown debris target species: ${row.target}`)
      }
    }
  }
  return errors
}
export { StrikeDebrisSchema, StrikeDebrisJsonGuard, strikeDebrisCatalogueRules }
export type { StrikeDebris, StrikeDebrisPolicy, StrikeDebrisCatalogue }
