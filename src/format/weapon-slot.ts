// FORMAT-PRUNE FP22d: where a row names a held weapon (a loadout slot, a finish's weapon), it names an engine-native closed
// name (until `items.legacySlot` goes, FP22e) or the declared item the weapon plays under, `declared.<equipment id>`.
import { custom, picklist, union } from 'valibot'

import type { GenericSchema } from 'valibot'

type DeclaredWeaponId = `declared.weapon.${string}`
type WeaponSlot =
  | 'crossbow'
  | 'sword'
  | 'rifle'
  | 'sword-iron'
  | 'bow'
  | 'sabre'
  | 'spear'
  | 'empty'
  | DeclaredWeaponId

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
const WeaponSlotSchema: GenericSchema<WeaponSlot> = union([
  picklist([
    'crossbow',
    'sword',
    'rifle',
    'sword-iron',
    'bow',
    'sabre',
    'spear',
    'empty',
  ]),
  DeclaredWeaponSchema,
])

export {
  DECLARED_LIMIT,
  DECLARED_PATTERN,
  DeclaredWeaponSchema,
  WeaponSlotSchema,
  type DeclaredWeaponId,
  type WeaponSlot,
}
