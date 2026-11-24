import { is } from 'valibot'
import { expect, test } from 'vitest'

import { WeaponSlotSchema } from './weapon-slot.ts'

test('FP22e: a held weapon slot is a declared weapon id, never a closed name', (): void => {
  const good = ['declared.weapon.lever', 'declared.weapon.driftwood-isle.iron']
  const bad = [
    'crossbow',
    'rifle',
    'empty',
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
