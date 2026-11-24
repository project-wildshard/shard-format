import { is } from 'valibot'
import { expect, test } from 'vitest'

import { WeaponSlotSchema } from './weapon-slot.ts'

test('FP22d: a held weapon slot is a closed name or a declared weapon id', (): void => {
  const good = [
    'crossbow',
    'rifle',
    'empty',
    'declared.weapon.lever',
    'declared.weapon.driftwood-isle.iron',
  ]
  const bad = [
    'lever',
    'declared.tool.rope',
    'declared.weapon.',
    'declared.weapon.Lever',
    'weapon.lever',
    7,
  ]
  expect(good.filter((slot): boolean => !is(WeaponSlotSchema, slot))).toEqual(
    [],
  )
  expect(bad.filter((slot): boolean => is(WeaponSlotSchema, slot))).toEqual([])
})
