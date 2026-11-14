import { parse, safeParse } from 'valibot'
import { expect, test } from 'vitest'

import {
  LOOK_SKY_BUDGET,
  LookSkySchema,
  lookSkyErrors,
  lookSkyRules,
} from './look-sky.ts'
import { parseShardfileField } from './shardSchema.ts'

type Fields = Readonly<Record<string, unknown>>
const CHAIN = 200

// Meta SHARD-SOURCE AP14: a sky is an unlit material graph on the dome, its colour along normalize(positionLocal).
function sky(extra: Fields = {}, nodes: Fields = {}): Record<string, unknown> {
  return {
    version: 1,
    kind: 'material',
    model: 'unlit',
    params: { zenith: { type: 'colour', value: [0.2, 0.2, 0.5] } },
    nodes: {
      pos: { op: 'positionLocal' },
      dir: { op: 'normalize', in: ['pos'] },
      up: { op: 'swizzle', in: ['dir'], mask: 'y' },
      top: { op: 'param', param: 'zenith' },
      out: { op: 'mix', in: [[1, 0.7, 0.5], 'top', 'up'] },
      ...nodes,
    },
    stages: { surface: { colour: 'out' } },
    ...extra,
  }
}

test('an unlit dome graph is a sky', (): void => {
  expect(lookSkyErrors(sky())).toEqual([])
  expect(parse(LookSkySchema, { graph: sky() }).graph.kind).toBe('material')
})

test('a post graph, a lit graph or extra stages are refused with the reason', (): void => {
  const post = sky({ kind: 'post', stages: { post: { colour: 'out' } } })
  delete post['model']
  expect(lookSkyErrors(post).join('\n')).toMatch(/sky: /u)
  expect(lookSkyErrors(sky({ model: 'standard' }))).toContain(
    'sky: an unlit material graph (kind material, model unlit)',
  )
  expect(
    lookSkyErrors(sky({ stages: { surface: { colour: 'out', alpha: 0.5 } } })),
  ).toContain('sky: surface.colour only (not alpha)')
  expect(
    lookSkyErrors(
      sky({
        stages: {
          surface: { colour: 'out' },
          'vertex.offset': { offset: [0, 0, 0] },
        },
      }),
    ).join('\n'),
  ).toMatch(/only the surface stage/u)
  expect(
    safeParse(LookSkySchema, { graph: sky({ model: 'standard' }) }).success,
  ).toBe(false)
})

test('a sky reads no texture and stays under its own budget', (): void => {
  const textured = sky(
    { params: { map: { type: 'texture', value: 'a'.repeat(64) } } },
    {
      tex: { op: 'texture', param: 'map', in: [[0.5, 0.5]] },
      out: { op: 'swizzle', in: ['tex'], mask: 'xyz' },
    },
  )
  expect(lookSkyErrors(textured).length).toBeGreaterThan(0)
  // The cleanroom's clouds are a few hundred nodes: past a material's default 160, inside the sky's own budget.
  const chain: Record<string, unknown> = {}
  let last = 'up'
  for (let step = 0; step < CHAIN; step += 1) {
    chain[`s${step}`] = { op: 'sin', in: [last] }
    last = `s${step}`
  }
  expect(
    lookSkyErrors(sky({}, { ...chain, out: { op: 'mul', in: ['top', last] } })),
  ).toEqual([])
  expect(LOOK_SKY_BUDGET.samplers).toBe(0)
})

test('a sky param binds only to the shard day keys', (): void => {
  const bound = sky({
    params: {
      zenith: {
        type: 'colour',
        value: [0.2, 0.2, 0.5],
        bind: { day: 'sky.zenith' },
      },
    },
  })
  const { graph } = parse(LookSkySchema, { graph: bound })
  expect(lookSkyErrors(graph, { dayKeys: ['sky.zenith'] })).toEqual([])
  expect(lookSkyErrors(graph, { dayKeys: [] }).length).toBeGreaterThan(0)
  const none = { day: new Map<string, string>(), state: [] }
  expect(lookSkyRules(undefined, none)).toEqual([])
  expect(lookSkyRules(graph, none).length).toBeGreaterThan(0)
  expect(
    lookSkyRules(graph, { day: new Map([['sky.zenith', 'vec3']]), state: [] }),
  ).toEqual([])
})

test('a look carries a sky, or none and keeps its bytes', (): void => {
  const look = {
    families: ['pbr'],
    // The format writes no LUT as JSON null.
    // oxlint-disable-next-line unicorn/no-null
    grade: { exposure: 0, saturation: 1, contrast: 1, lut: null },
    clock: 'engine',
    dayOverride: 0.5,
    keys: [],
  }
  expect('sky' in parseShardfileField('look', look)).toBe(false)
  expect(
    parseShardfileField('look', { ...look, sky: { graph: sky() } }).sky?.graph
      .model,
  ).toBe('unlit')
  expect((): unknown =>
    parseShardfileField('look', {
      ...look,
      sky: { graph: sky({ model: 'standard' }) },
    }),
  ).toThrow()
})
