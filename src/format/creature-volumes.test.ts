import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { CreatureBodySchema } from './creature-layers.ts'

import type { CreatureBody } from './creature-layers.ts'

const baseBody = {
  skeleton: 'quadruped',
  size: 'medium',
  scale: 1,
  look: 'fixture.look',
}
const layered = { body: baseBody }
function rows(input: { readonly body: unknown }): {
  species: { body: CreatureBody }[]
} {
  return { species: [{ body: parse(CreatureBodySchema, input.body) }] }
}
const headVolume = {
  part: 'head',
  bone: 'head',
  shape: 'sphere',
  radius: 0.1,
  halfLength: 0,
  axis: 'y',
  multiplier: 2,
}
test('body volumes retain tiny source radii, zero damage and bone-local offsets', (): void => {
  const body = {
    ...layered.body,
    volumes: [
      headVolume,
      {
        ...headVolume,
        part: 'shield',
        bone: 'hand.L',
        radius: 0.5,
        multiplier: 0,
        at: [0, 0.2, 0],
      },
    ],
    lock: ['chest'],
  }
  expect(rows({ ...layered, body }).species[0]?.body).toEqual(body)
  expect(
    rows({
      ...layered,
      body: {
        ...body,
        size: 'giant',
        hits: 'clip',
        lock: ['head', 'chest', 'back'],
      },
    }).species[0]?.body.hits,
  ).toBe('clip')
})

test('absent volume and lock fields preserve original bytes', (): void => {
  expect(parse(CreatureBodySchema, baseBody)).toEqual(baseBody)
  expect(Object.hasOwn(parse(CreatureBodySchema, baseBody), 'lock')).toBe(false)
  expect(Object.hasOwn(parse(CreatureBodySchema, baseBody), 'volumes')).toBe(
    false,
  )
})

test('malformed or ambiguous creature volume rows refuse', (): void => {
  const invalid: unknown[] = [
    [],
    [headVolume, headVolume],
    [{ ...headVolume, radius: 0 }],
    [{ ...headVolume, radius: Number.NaN }],
    [{ ...headVolume, radius: Infinity }],
    [{ ...headVolume, multiplier: -1 }],
    [{ ...headVolume, multiplier: 101 }],
    [{ ...headVolume, halfLength: 1 }],
    [{ ...headVolume, shape: 'mesh' }],
    [{ ...headVolume, part: '../head' }],
    [{ ...headVolume, bone: '' }],
    [{ ...headVolume, at: [0, 0] }],
    [{ ...headVolume, at: [0, 0, Infinity] }],
    [{ ...headVolume, extra: true }],
    [{ ...headVolume, axis: 'x' }],
    Array.from({ length: 17 }, (_unused: unknown, index: number): object => ({
      ...headVolume,
      part: `part${index}`,
    })),
  ]
  for (const volumes of invalid) {
    expect((): unknown =>
      rows({ ...layered, body: { ...layered.body, volumes } }),
    ).toThrow()
  }
})

test('resolved volume cap counts skeleton defaults and replaces matching parts', (): void => {
  const volumes = Array.from(
    { length: 15 },
    (_unused: unknown, index: number): object => ({
      ...headVolume,
      part: `part${index}`,
    }),
  )
  expect((): unknown =>
    rows({ ...layered, body: { ...layered.body, volumes } }),
  ).toThrow('Too many resolved creature volumes')
  expect(
    rows({
      ...layered,
      body: { ...layered.body, volumes: [headVolume, ...volumes.slice(0, 14)] },
    }).species[0]?.body.volumes,
  ).toHaveLength(15)
})

test('only giants admit multiple unique lock points and clip-hit opt-in', (): void => {
  for (const extra of [
    { lock: [] },
    { lock: ['head', 'head'] },
    { lock: ['head', 'chest'] },
    { lock: ['../head'] },
    { hits: 'clip' },
    { hits: 'mesh' },
  ]) {
    expect((): unknown =>
      rows({ ...layered, body: { ...layered.body, ...extra } }),
    ).toThrow()
  }
  expect((): unknown =>
    rows({
      ...layered,
      body: { ...layered.body, size: 'giant', lock: ['head', 'head'] },
    }),
  ).toThrow('Duplicate creature lock point')
})
