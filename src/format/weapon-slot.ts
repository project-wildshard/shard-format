// FORMAT-PRUNE FP22d/FP22e: where a row names a held weapon (a loadout slot, a finish's weapon), it names the declared
// item the weapon plays under, `declared.<equipment id>`. The engine-native closed names went with the closed item slot field.
import { custom } from 'valibot'

import type { GenericSchema } from 'valibot'

type DeclaredWeaponId = `declared.weapon.${string}`
type WeaponSlot = DeclaredWeaponId

const DECLARED_LIMIT = 256
const DECLARED_PATTERN: string = String.raw`^declared\.weapon\.[a-z][a-zA-Z0-9.-]*$`
const DECLARED = new RegExp(DECLARED_PATTERN, 'u')

/** A declared weapon id: `declared.weapon.` and the rest of its equipment id. */
function isDeclaredWeapon(input: unknown): input is DeclaredWeaponId {
  return (
    typeof input === 'string' &&
    input.length <= DECLARED_LIMIT &&
    DECLARED.test(input)
  )
}

const DeclaredWeaponSchema: GenericSchema<DeclaredWeaponId> =
  custom<DeclaredWeaponId>(isDeclaredWeapon, 'a declared weapon id')
const WeaponSlotSchema: GenericSchema<WeaponSlot> = DeclaredWeaponSchema

export {
  DECLARED_LIMIT,
  DECLARED_PATTERN,
  DeclaredWeaponSchema,
  WeaponSlotSchema,
  type DeclaredWeaponId,
  type WeaponSlot,
}
