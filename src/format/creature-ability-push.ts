import {
  check,
  exactOptional,
  finite,
  maxValue,
  minValue,
  number,
  picklist,
  pipe,
} from 'valibot'

import type { CheckAction, ExactOptionalSchema, GenericSchema } from 'valibot'

/** How an ability pushes the player it strikes, and where on that player it aims (OF20c1). */
interface CreatureAbilityPush {
  /** `knockback` slides the struck player; `impulse` throws it along the strike's facing. */
  effect?: 'knockback' | 'impulse'
  /** Knockback: horizontal travel in metres on clear ground. Impulse: horizontal speed in m/s (at most 40). */
  strength?: number
  /** Impulse only: upward speed in m/s. */
  lift?: number
  /** Metres above the target's feet the strike aims at (a stoop at the chest); absent, the feet. */
  aimHeight?: number
}

const ZERO = 0
const MAX_KNOCKBACK_DISTANCE = 60
const MAX_IMPULSE_SPEED = 40
const MAX_AIM_HEIGHT = 10
const scalar = pipe(number(), finite())
const knockback = pipe(scalar, minValue(ZERO), maxValue(MAX_KNOCKBACK_DISTANCE))
const impulse = pipe(scalar, minValue(ZERO), maxValue(MAX_IMPULSE_SPEED))
const aim = pipe(scalar, minValue(ZERO), maxValue(MAX_AIM_HEIGHT))

/** The ability row's push fields, spread into its strict object. */
type Optional<Value> = ExactOptionalSchema<GenericSchema<Value>, undefined>
const abilityPushFields: {
  effect: Optional<'knockback' | 'impulse'>
  strength: Optional<number>
  lift: Optional<number>
  aimHeight: Optional<number>
} = {
  effect: exactOptional(picklist(['knockback', 'impulse'])),
  strength: exactOptional(knockback),
  lift: exactOptional(impulse),
  aimHeight: exactOptional(aim),
}
const PUSH_RULE =
  'Creature push effect and strength go together; lift needs an impulse of at most 40 m/s'
const pushRule = ({
  effect,
  strength,
  lift,
}: Readonly<CreatureAbilityPush>): boolean =>
  (effect === undefined) === (strength === undefined) &&
  (lift === undefined || effect === 'impulse') &&
  (effect !== 'impulse' || (strength ?? ZERO) <= MAX_IMPULSE_SPEED)
/** The push rule, typed to the row it guards. */
function abilityPushCheck<Row extends CreatureAbilityPush>(): CheckAction<
  Row,
  typeof PUSH_RULE
> {
  return check<Row, typeof PUSH_RULE>(pushRule, PUSH_RULE)
}

export { abilityPushCheck, abilityPushFields }
export type { CreatureAbilityPush }
