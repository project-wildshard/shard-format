import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { CreaturesSchema } from './creatures.ts'

/** A plain spawn row, read from JSON as an author's file would be (its brain and strike are JSON nulls). */
const SPAWN_JSON =
  '{"id":"wolf.1","species":"kit.wolf","variant":"grey","brain":null,"strike":null,"seed":1,"scale":1,"at":[0,0,0],"yaw":0'
function spawn(when?: string): unknown {
  return JSON.parse(
    when === undefined ? `${SPAWN_JSON}}` : `${SPAWN_JSON},"when":${when}}`,
  )
}
function rows(when?: string): unknown {
  return { brains: [], spawns: [spawn(when)] }
}

test('OF28c: each spawn condition parses; a row without one parses byte-identical', (): void => {
  const plain = { brains: [], groups: [], spawns: [spawn()] }
  expect(JSON.stringify(parse(CreaturesSchema, plain))).toBe(
    JSON.stringify(plain),
  )
  const all =
    '{"quest":{"id":"wolves","stage":2},"time":"night","wave":{"set":"den","index":3}}'
  expect(parse(CreaturesSchema, rows(all)).spawns[0]?.when).toEqual({
    quest: { id: 'wolves', stage: 2 },
    time: 'night',
    wave: { set: 'den', index: 3 },
  })
  expect(
    parse(CreaturesSchema, rows('{"time":"day"}')).spawns[0]?.when,
  ).toEqual({ time: 'day' })
})

test('OF28c: an unknown condition or time refuses with a named error; bad stages and waves refuse', (): void => {
  expect((): unknown =>
    parse(CreaturesSchema, rows('{"weather":"rain"}')),
  ).toThrow('unknown spawn condition')
  expect((): unknown =>
    parse(CreaturesSchema, rows('{"time":"dusk"}')),
  ).toThrow('unknown spawn time')
  for (const bad of [
    '{"quest":{"id":"wolves"}}',
    '{"quest":{"id":"wolves","stage":-1}}',
    '{"quest":{"id":"wolves","stage":1.5}}',
    '{"wave":{"set":"den","index":0}}',
    '{"wave":{"index":1}}',
  ]) {
    expect((): unknown => parse(CreaturesSchema, rows(bad))).toThrow()
  }
})
