import {
  finite,
  gtValue,
  minValue,
  maxValue,
  number,
  pipe,
  strictObject,
} from 'valibot'

import type { GenericSchema } from 'valibot'

interface CreatureProjectile {
  /** Metres per second at launch. */
  speed: number
  /** Downward acceleration, metres per second squared. */
  gravity: number
  /** Sphere radius in metres. */
  radius: number
}

const zero = 0
const maxRadius = 500
const finiteNumber = pipe(number(), finite())
const positive = pipe(finiteNumber, gtValue(zero))
const gravity = pipe(finiteNumber, minValue(zero))
const radius = pipe(positive, maxValue(maxRadius))
const CreatureProjectileSchema: GenericSchema<CreatureProjectile> =
  strictObject({ speed: positive, gravity, radius })

export { CreatureProjectileSchema }
export type { CreatureProjectile }
