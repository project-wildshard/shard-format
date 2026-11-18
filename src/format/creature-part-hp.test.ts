// ONE-FORMAT CC31: a volume may carry part hp.
import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { CreatureBodySchema } from './creature-layers.ts'

const plate = {
  part: 'plate.L',
  bone: 'chest',
  shape: 'capsule',
  radius: 0.4,
  halfLength: 0.3,
  axis: 'y',
  multiplier: 1,
  hp: 30,
}
const body = {
  skeleton: 'biped',
  size: 'medium',
  scale: 1,
  look: 'fixture.look',
  volumes: [plate],
}

test('a volume keeps its part hp', (): void => {
  expect(parse(CreatureBodySchema, body)).toEqual(body)
})

test.each([0, -1, 2_000_000, Number.NaN])(
  'part hp %d refuses',
  (hp: number): void => {
    const bad = { ...body, volumes: [{ ...plate, hp }] }
    expect((): unknown => parse(CreatureBodySchema, bad)).toThrow()
  },
)
