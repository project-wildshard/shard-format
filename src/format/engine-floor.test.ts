import { is } from 'valibot'
import { expect, test } from 'vitest'

import { engineFloorRefusal } from './engine-floor.ts'
import { RequiresSchema } from './shardSections.ts'
import { outputIndexEnvelope } from './version.ts'

// FORMAT-PRUNE FP47b (J505): SDK 0.4.31 stamps engine 0.1.83 (the grid shell that reads look/look) in
// `requires.engine`; an older grid refuses its products.

test('a 0.4.31-built product (floor 0.1.83) is refused by a v0.1.82 grid and drawn from 0.1.83 on', (): void => {
  expect(engineFloorRefusal('0.1.83', '0.1.82')).toBe(
    'This shard needs engine 0.1.83 or newer; this engine is 0.1.82 (requires.engine)',
  )
  expect(engineFloorRefusal('0.1.83', '0.1.83')).toBeUndefined()
  expect(engineFloorRefusal('0.1.83', '0.1.83-next.839c8ba0')).toBeUndefined()
  expect(engineFloorRefusal('0.1.83', '0.2.0')).toBeUndefined()
  expect(engineFloorRefusal('0.1.83', '0.1.9')).toBeDefined()
})

test('no floor is drawn anywhere; an unreadable engine version refuses a floor', (): void => {
  expect(engineFloorRefusal(undefined, '0.1.0')).toBeUndefined()
  expect(engineFloorRefusal('0.1.83', 'main')).toBeDefined()
})

test('requires.engine is an X.Y.Z release', (): void => {
  const base = { commons: [] }
  expect(is(RequiresSchema, { ...base, engine: '0.1.83' })).toBe(true)
  expect(is(RequiresSchema, { ...base, engine: '0.1.83-next.1' })).toBe(false)
  expect(is(RequiresSchema, { ...base, engine: 'v0.1.83' })).toBe(false)
})

test('a writer at an older format drops requires.engine; at 0.1.0.6 it keeps it', (): void => {
  const requires = { commons: [], engine: '0.1.83' }
  const older = outputIndexEnvelope({
    version: '0.1.0.5',
    requires,
    runtime: {},
  })
  expect(older.requires).toEqual({ commons: [] })
  const current = outputIndexEnvelope({
    version: '0.1.0.6',
    requires,
    runtime: {},
  })
  expect(current.requires).toEqual(requires)
})
