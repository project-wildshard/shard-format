import { expect, test } from 'vitest'

import {
  headlessSections,
  productHeadlessSections,
} from './headless-sections.ts'
import { parseVehicles } from './vehicles.ts'

import type { Vehicles } from './vehicles.ts'

const vehicles: Vehicles = {
  kinds: [
    {
      id: 'sail',
      panel: 'sail',
      seats: [
        { role: 'driver', at: [0, 1, 0], leave: [2, 0, 0], pose: 'stand' },
      ],
      hull: [{ at: [0, 0.5, 0], half: [0.5, 0.5, 1] }],
      handling: {
        speed: 12,
        reverse: 0,
        accel: 4,
        brake: 6,
        turn: 1,
        grip: 0.9,
        drift: 0.3,
        boost: 1.6,
        mass: 250,
        ground: true,
      },
    },
  ],
  docks: [
    {
      id: 'line.red',
      kind: 'sail',
      at: [0, 0, 0],
      yaw: 0,
      per: 'shared',
      respawn: 30,
    },
    {
      id: 'reward',
      kind: 'sail',
      at: [5, 0, 0],
      yaw: 0,
      per: 'player',
      respawn: 30,
      requiresFlag: 'cup.done',
    },
  ],
}

test('vehicle docks and personal locks survive both worker transports', (): void => {
  const product = {
    has: (name: string): boolean => name === 'world/vehicles',
    section: (): Vehicles => vehicles,
  }
  const sent = productHeadlessSections(product)
  const received = headlessSections(structuredClone(sent))
  expect(received.get('world/vehicles')).toEqual(parseVehicles(vehicles))
  expect((): Map<string, unknown> =>
    headlessSections(new Map([['world/vehicles', { docks: [] }]])),
  ).toThrow()
})
