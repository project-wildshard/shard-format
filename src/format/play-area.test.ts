/* oxlint-disable id-length -- x0/z1 are the bound field names (PR6c) */
import { expect, test } from 'vitest'

import { declaredPlayArea } from './play-area.ts'

const authored = { x0: -100, x1: 100, z0: -100, z1: 100, floor: 2 }

test('a shard with no plan rows plays in its authored bounds (PR6c)', (): void => {
  const area = declaredPlayArea(authored, [])
  expect([area?.x0, area?.z1, area?.floorAt(0, 0)]).toEqual([-100, 100, 2])
  expect(declaredPlayArea(undefined, [])).toBeUndefined()
})

test('player.enter replaces the bounds; runtime hooks win and drop the floor past their radius (PR6c)', (): void => {
  const enter = { x0: -250, x1: 250, z0: -250, z1: 250, floor: -8 }
  const hooks = {
    x: [-300, 300] as const,
    z: [-300, 300] as const,
    outer: { maxAbsXZ: 200, floor: -20 },
  }
  const entered = declaredPlayArea(authored, [
    { kind: 'player.enter', bounds: enter },
  ])
  expect([entered?.x1, entered?.floorAt(0, 0)]).toEqual([250, -8])
  const both = declaredPlayArea(authored, [
    { kind: 'world.runtime-hooks', bounds: hooks },
    { kind: 'player.enter', bounds: enter },
  ])
  expect([both?.x1, both?.floorAt(10, 10), both?.floorAt(250, 0)]).toEqual([
    300, 2, -20,
  ])
  expect(
    declaredPlayArea(undefined, [
      { kind: 'world.runtime-hooks', bounds: hooks },
    ]),
  ).toBeUndefined()
})
