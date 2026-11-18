import {
  array,
  check,
  exactOptional,
  finite,
  lazy,
  literal,
  maxLength,
  minLength,
  number,
  picklist,
  pipe,
  regex,
  strictObject,
  string,
} from 'valibot'

import type { GenericSchema } from 'valibot'

/** The two held families a weapon belongs to (OF38): a strike in reach, or a shot. */
const WEAPON_CLASSES = ['melee', 'ranged'] as const
type WeaponClass = (typeof WEAPON_CLASSES)[number]
/** At most this many memory states shield one creature. */
const MAX_SHIELDS = 16
const MAX_FIELD = 64
const MIN_ONE = 1

/** A memory state that shields the creature while its field holds this value (Nalati's `hidden` and `owned`). */
interface AttackShield {
  field: string
  equals: number
}
/**
 * ONE-FORMAT OF38a (J420 (2), Jake 2026-11-18: *"creatures themselves should define whether they can be attacked or
 * not"*). A species row says whether its creatures can be attacked, and by what, if a shard needs that: `false` is
 * never; `by` names the weapon classes that may hit it (default both); `unless` names the creature-memory states that
 * shield it. A row without it can be attacked by anything, as before. The held primitives read it; no weapon carries a
 * target list (Nalati's `combat.targets` goes, OF38c).
 */
type CreatureAttackable =
  | false
  | {
      by?: WeaponClass[]
      unless?: AttackShield[]
    }
/** The declaration as `attackableBy` reads it. */
type AttackableReading =
  | false
  | {
      readonly by?: readonly WeaponClass[]
      readonly unless?: readonly Readonly<AttackShield>[]
    }

function distinct(values: readonly unknown[]): boolean {
  return new Set(values).size === values.length
}
function distinctFields(rows: readonly Readonly<AttackShield>[]): boolean {
  return distinct(rows.map((row: Readonly<AttackShield>): string => row.field))
}

const fieldName = regex(/^[a-z][A-Za-z0-9]*$/u, 'Unknown attackable field')
const field = pipe(
  string(),
  minLength(MIN_ONE),
  maxLength(MAX_FIELD),
  fieldName,
)
const equals = pipe(number(), finite())
const shield = strictObject(
  { field, equals },
  'Unknown attackable shield field',
)
const weaponClass = picklist(WEAPON_CLASSES, 'Unknown attackable weapon class')
const byClasses = pipe(
  array(weaponClass),
  minLength(MIN_ONE, 'Attackable by needs a weapon class'),
  check<WeaponClass[], string>(
    distinct,
    'Attackable by repeats a weapon class',
  ),
)
const shields = pipe(
  array(shield),
  maxLength(MAX_SHIELDS),
  check<AttackShield[], string>(
    distinctFields,
    'Attackable unless repeats a field',
  ),
)
const never: GenericSchema<false> = literal(
  false,
  'Attackable true is the default; omit it',
)
const declared: GenericSchema<{ by?: WeaponClass[]; unless?: AttackShield[] }> =
  strictObject(
    { by: exactOptional(byClasses), unless: exactOptional(shields) },
    'Unknown attackable field',
  )
/** `false`, or the object form; the input's own type picks which, so a refusal names the field at fault. */
const CreatureAttackableSchema: GenericSchema<CreatureAttackable> = lazy(
  (input: unknown): GenericSchema<CreatureAttackable> =>
    typeof input === 'boolean' ? never : declared,
)

/** Whether a weapon of this class may hit a creature of this declaration, given its memory. */
function attackableBy(
  declaration: AttackableReading | undefined,
  weapon: WeaponClass,
  memory: Readonly<Record<string, unknown>> = {},
): boolean {
  if (declaration === undefined) {
    return true
  }
  if (declaration === false) {
    return false
  }
  if (declaration.by !== undefined && !declaration.by.includes(weapon)) {
    return false
  }
  return !(declaration.unless ?? []).some(
    (row: Readonly<AttackShield>): boolean => memory[row.field] === row.equals,
  )
}

export type { AttackShield, AttackableReading, CreatureAttackable, WeaponClass }
export { CreatureAttackableSchema, WEAPON_CLASSES, attackableBy }
