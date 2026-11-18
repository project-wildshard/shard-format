import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { creatureSizeRules, spawnCapacity } from './creature-sizes.ts'
import { CreaturesSchema } from './creatures.ts'

/** A plain spawn row, read from JSON as an author's file would be (its brain and strike are JSON nulls). */
const SPAWN_JSON =
  '{"id":"wolf.1","species":"kit.wolf","variant":"grey","brain":null,"strike":null,"seed":1,"scale":1,"at":[0,0,0],"yaw":0'
function spawn(count?: string): unknown {
  return JSON.parse(
    count === undefined ? `${SPAWN_JSON}}` : `${SPAWN_JSON},"count":${count}}`,
  )
}
function species(
  id: string,
  size?: 'medium' | 'large' | 'giant',
): {
  id: string
  body?: { size: 'medium' | 'large' | 'giant'; scale: number; look: string }
  dims: { bodyY: number; bodyRadius: number; headRadius: number }
  variants: { scale: [number, number] }[]
} {
  return {
    id,
    ...(size === undefined ? {} : { body: { size, scale: 1, look: 'x' } }),
    dims: { bodyY: 0.5, bodyRadius: 0.3, headRadius: 0.2 },
    variants: [{ scale: [1, 1] }],
  }
}

const row = (
  name: string,
  max: number,
): {
  id: string
  species: string
  scale: number
  count: { per: number; max: number }
} => ({
  id: `${name}.1`,
  species: name,
  scale: 1,
  count: { per: 1, max },
})

test('OF28b: a spawn row takes a player-scaled count; a row without one parses byte-identical', (): void => {
  const plain = { brains: [], groups: [], spawns: [spawn()] }
  expect(JSON.stringify(parse(CreaturesSchema, plain))).toBe(
    JSON.stringify(plain),
  )
  const counted = parse(CreaturesSchema, {
    brains: [],
    spawns: [spawn('{"per":2,"max":5}')],
  })
  expect(counted.spawns[0]?.count).toEqual({ per: 2, max: 5 })
  for (const bad of [
    '{"per":0,"max":5}',
    '{"per":2,"max":1}',
    '{"per":2,"max":65}',
    '{"per":1.5,"max":5}',
    '{"max":5}',
    '{"per":2,"max":5,"min":1}',
  ]) {
    expect((): unknown =>
      parse(CreaturesSchema, { brains: [], spawns: [spawn(bad)] }),
    ).toThrow()
  }
})

test('OF28b: a count ceiling is weighed by size class: 16 medium, 4 large, no giant crowds', (): void => {
  const all = [
    species('wolf'),
    species('bear', 'large'),
    species('wyrm', 'giant'),
  ]
  expect(creatureSizeRules(all, [row('wolf', 16), row('bear', 4)])).toEqual([])
  expect(
    creatureSizeRules(all, [row('wolf', 17), row('bear', 5), row('wyrm', 2)]),
  ).toEqual([
    'spawn wolf.1: count ceiling outweighs its size class',
    'spawn bear.1: count ceiling outweighs its size class',
    'spawn wyrm.1: count ceiling outweighs its size class',
  ])
})

test('OF28b: entity capacity counts a row at its ceiling', (): void => {
  expect(spawnCapacity([{}, { count: { per: 2, max: 6 } }, {}])).toBe(8)
})
