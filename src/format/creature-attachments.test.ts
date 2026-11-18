// ONE-FORMAT CC30a: a body's socket attachments and the part a break flags.
import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { attachmentFileRules } from './creature-attachments.ts'
import { CreatureBodySchema } from './creature-layers.ts'

const GLB = 'a'.repeat(64)
const plate = {
  part: 'plate.L',
  bone: 'chest',
  shape: 'capsule',
  radius: 0.4,
  halfLength: 0.3,
  axis: 'y',
  multiplier: 1,
  hp: 30,
  channel: 'plate',
}
const axe = {
  id: 'axe',
  socket: 'hand.R',
  meshes: [{ id: 'axe.head', geometry: GLB, material: 'iron' }],
  at: [0, 0.1, 0] as [number, number, number],
}
const { channel: _channel, ...plainPlate } = plate
const { hp: _hp, ...softPlate } = plate
const body = {
  skeleton: 'biped',
  size: 'medium',
  scale: 1,
  look: 'fixture.look',
  volumes: [plate],
  channels: [{ name: 'plate' }, { name: 'rage' }],
  attachments: [
    axe,
    {
      id: 'plate.L',
      socket: 'chest',
      meshes: [{ id: 'plate.L.mesh', geometry: GLB, material: 'iron' }],
      part: 'plate.L',
    },
    {
      id: 'horns',
      socket: 'head',
      meshes: [{ id: 'horns.mesh', geometry: GLB, material: 'bone' }],
      when: { channel: 'rage', at: 0.5 },
      desktop: true,
    },
  ],
}

test('admission keeps an axe on hand.R', (): void => {
  expect(parse(CreatureBodySchema, body)).toEqual(body)
})

test.each([
  [
    'a ninth attachment',
    {
      attachments: Array.from(
        { length: 9 },
        (_unused: unknown, index: number): object => ({
          ...axe,
          id: `axe${String(index)}`,
          meshes: [
            { id: `m${String(index)}`, geometry: GLB, material: 'iron' },
          ],
        }),
      ),
    },
  ],
  ['an unknown socket', { attachments: [{ ...axe, socket: 'tail' }] }],
  [
    'an undeclared when channel',
    { attachments: [{ ...axe, when: { channel: 'glow' } }] },
  ],
  ['a part naming no volume', { attachments: [{ ...axe, part: 'plate.R' }] }],
  [
    'a part without a break channel',
    {
      volumes: [plainPlate],
      attachments: [{ ...axe, part: 'plate.L' }],
    },
  ],
  [
    'a volume channel nobody declares',
    { volumes: [{ ...plate, channel: 'armour' }] },
  ],
  ['a volume channel without hp', { volumes: [softPlate] }],
  ['a duplicate attachment', { attachments: [axe, axe] }],
  [
    'five meshes',
    {
      attachments: [
        {
          ...axe,
          meshes: ['a', 'b', 'c', 'd', 'e'].map((id: string): object => ({
            id,
            geometry: GLB,
            material: 'iron',
          })),
        },
      ],
    },
  ],
  [
    'a geometry that is no hash',
    {
      attachments: [
        {
          ...axe,
          meshes: [{ id: 'x', geometry: 'axe.glb', material: 'iron' }],
        },
      ],
    },
  ],
])('%s refuses', (_name: string, change: object): void => {
  expect((): unknown =>
    parse(CreatureBodySchema, { ...body, ...change }),
  ).toThrow()
})

test('a serpent hangs on its own sockets', (): void => {
  const serpent = {
    skeleton: 'serpent',
    trail: { count: 4, spacing: 0.5 },
    size: 'large',
    scale: 1,
    look: 'fixture.look',
    attachments: [{ ...axe, socket: 'core' }],
  }
  expect(parse(CreatureBodySchema, serpent)).toEqual(serpent)
})

test('a GLB-rigged body names any bone', (): void => {
  const own = {
    size: 'large',
    scale: 1,
    look: 'fixture.look',
    attachments: [{ ...axe, socket: 'Bone.042' }],
  }
  expect(parse(CreatureBodySchema, own)).toEqual(own)
})

test('an attachment draws a library GLB with a declared material', (): void => {
  const species = [{ id: 'mech', body }]
  const files = [{ hash: GLB, kind: 'glb' }]
  const materials = { iron: {}, bone: {} }
  expect(
    attachmentFileRules({ species, files, library: [GLB], materials }),
  ).toEqual([])
  expect(
    attachmentFileRules({ species, files, library: [], materials }),
  ).toEqual(['creature attachment geometry'])
  expect(
    attachmentFileRules({
      species,
      files,
      library: [GLB],
      materials: { iron: {} },
    }),
  ).toEqual(['creature attachment material'])
})
