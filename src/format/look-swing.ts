/**
 * `look.light.swings` (meta SHARD-SOURCE SS8b): bodies that hang and swing (a lantern on its rope, a sign, a banner), at
 * most `LOOK_SWINGS_MAX`. Each hangs from `pivot` with its body `length` metres below, swings at about `rate` hertz, leans
 * up to `amount` radians in a gust, and swings when a player or creature comes within `reach` metres of its body (0
 * never). A surface's `_SWING` channel (`scene-render.ts`) and a lamp's `swing` name a row by number, so the lamp's light
 * turns with its lantern round the same pivot.
 *
 * Plain data and checks, no three.js.
 */
import {
  array,
  finite,
  integer,
  maxLength,
  maxValue,
  minLength,
  minValue,
  number,
  pipe,
  strictObject,
  tuple,
} from 'valibot'

import type { GenericSchema } from 'valibot'

type Point = [number, number, number]

/** At most this many swings in one look (one uniform array on every swinging draw, phones included). */
const LOOK_SWINGS_MAX = 32
const NONE = 0
const ONE = 1
const LENGTH_MIN = 0.05
const LENGTH_MAX = 10
const RATE_MIN = 0.05
const RATE_MAX = 4
const AMOUNT_MAX = 0.6
const REACH_MAX = 3

/** A hanging body: its pivot, body length, swing rate (hertz), gust lean (radians) and bump reach (metres). */
interface LookSwing {
  pivot: Point
  length: number
  rate: number
  amount: number
  reach: number
}

const real = pipe(number(), finite())
const range = (low: number, high: number): GenericSchema<number, number> =>
  pipe(real, minValue(low), maxValue(high))

const LookSwingSchema: GenericSchema<LookSwing, LookSwing> = strictObject({
  pivot: tuple([real, real, real]),
  length: range(LENGTH_MIN, LENGTH_MAX),
  rate: range(RATE_MIN, RATE_MAX),
  amount: range(NONE, AMOUNT_MAX),
  reach: range(NONE, REACH_MAX),
})
const LookSwingsSchema: GenericSchema<LookSwing[], LookSwing[]> = pipe(
  array(LookSwingSchema),
  minLength(ONE),
  maxLength(LOOK_SWINGS_MAX),
)
/** A lamp's `swing`: the number of the row it hangs from. */
const swingNumber: GenericSchema<number, number> = pipe(
  real,
  integer(),
  minValue(NONE),
  maxValue(LOOK_SWINGS_MAX - ONE),
)

/** What `swingsDeclared` reads of a `look.light`. */
interface SwingRefs {
  readonly lamps?: readonly { readonly swing?: number }[] | undefined
  readonly swings?: readonly unknown[] | undefined
}

/** Every lamp's `swing` names a declared swing. */
function swingsDeclared(light: SwingRefs): boolean {
  const declared = light.swings?.length ?? NONE
  for (const lamp of light.lamps ?? []) {
    if (lamp.swing !== undefined && lamp.swing >= declared) {
      return false
    }
  }
  return true
}

/** Every lamp's `panel` names a declared `props.panels` row. */
function lampPanelErrors(
  lamps: readonly Readonly<{ panel?: string }>[],
  panels: readonly Readonly<{ id: string }>[],
): string[] {
  const declared = new Set(panels.map((row): string => row.id))
  const errors: string[] = []
  for (const lamp of lamps) {
    if (lamp.panel !== undefined && !declared.has(lamp.panel)) {
      errors.push(
        `look lamp names panel ${lamp.panel}, which props.panels does not declare`,
      )
    }
  }
  return errors
}

export {
  LOOK_SWINGS_MAX,
  lampPanelErrors,
  LookSwingSchema,
  LookSwingsSchema,
  swingNumber,
  swingsDeclared,
}
export type { LookSwing, SwingRefs }
