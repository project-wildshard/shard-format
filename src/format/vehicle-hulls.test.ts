/* oxlint-disable id-length, typescript/explicit-function-return-type, typescript/no-unsafe-type-assertion, unicorn/no-null -- PR6b fixtures: x/z are the box field names, and the source is a partial shard */
import { expect, test } from 'vitest'

import { treadBoxes } from './tread-boxes.ts'
import { vehicleHulls } from './vehicle-hulls.ts'

const box = { kind: 'box', x: 12, y: 0.7, z: 5, hx: 0.6, hy: 0.125, hz: 1.8 }

test('a steer vehicle turned a quarter keeps its panel box in its own frame (PR6b)', (): void => {
  const source = {
    movers: [
      {
        id: 'salt.sail',
        kind: 'channel',
        driver: { kind: 'steer' },
        at: { x: 10, y: 0, z: 5 },
        euler: { x: 0, y: Math.PI / 2, z: 0 },
      },
      {
        id: 'lift',
        kind: 'channel',
        driver: { kind: 'lift' },
        at: { x: 0, y: 0, z: 0 },
        euler: { x: 0, y: 0, z: 0 },
      },
    ],
    props: {
      colliders: [
        { panel: 'salt.sail', shapes: [box, { kind: 'treads' }] },
        { panel: null, shapes: [box] },
      ],
    },
  } as unknown as Parameters<typeof vehicleHulls>[0]
  const hulls = vehicleHulls(source)
  expect([...hulls.keys()]).toEqual(['salt.sail'])
  const [hull] = hulls.get('salt.sail') ?? []
  // 2 m along the cell's x is 2 m along the vehicle's +z once it has turned a quarter about y.
  expect(
    [hull?.x, hull?.y, hull?.z].map(
      value => Math.round((value ?? 0) * 1e6) / 1e6,
    ),
  ).toEqual([0, 0.7, 2])
  expect(Math.abs(hull?.rot.y ?? 0)).toBeCloseTo(Math.SQRT1_2, 12)
})

test('a stair of four treads is four boxes climbing to its top (PR6b)', (): void => {
  const boxes = treadBoxes({
    from: { x: 0, y: 0, z: 0 },
    to: { x: 0, y: 2, z: 4 },
    width: 2,
    count: 4,
    friction: 0.8,
  })
  expect(
    boxes.map(row => [row.z, row.hy * 2, row.hz, row.hx, row.friction]),
  ).toEqual([
    [0.5, 0.5, 0.5, 1, 0.8],
    [1.5, 1, 0.5, 1, 0.8],
    [2.5, 1.5, 0.5, 1, 0.8],
    [3.5, 2, 0.5, 1, 0.8],
  ])
})
