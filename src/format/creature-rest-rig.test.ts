/* oxlint-disable max-statements, no-use-before-define, typescript/explicit-function-return-type, typescript/no-unsafe-type-assertion, typescript/prefer-readonly-parameter-types -- PR6a fixtures over the corpus GLBs */
// SHARD-COMPAT PR6a: the rest rig and skin bounds read with format code only. Engine's test
// (creature-rest-rig-format.test.ts) holds them bit for bit to the three.js reading it replaced.
import { readdirSync, readFileSync } from 'node:fs'

import { expect, test } from 'vitest'

import { creatureRestRig } from './creature-rest-rig.ts'
import { creatureSkinBounds } from './creature-skin-bounds.ts'
import { decompose, determinant, invert } from './mat4.ts'

function skinned(): readonly string[] {
  return readdirGlb().filter(file => jointNames(readFileSync(file)).length > 0)
}

function readdirGlb(): readonly string[] {
  const dir = 'corpus/exports/brasscap-mesa/blobs/glb'
  return readdirSync(dir).map(name => `${dir}/${name}`)
}

function jointNames(bytes: Uint8Array): readonly string[] {
  const length = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getUint32(12, true)
  const doc = JSON.parse(
    new TextDecoder().decode(bytes.subarray(20, 20 + length)),
  ) as {
    nodes: { name?: string }[]
    skins?: { joints: number[] }[]
  }
  return doc.skins?.length === 1
    ? (doc.skins[0]?.joints ?? []).map(node => doc.nodes[node]?.name ?? '')
    : []
}

test('a translation inverts to its negation and decomposes unrotated and unscaled', () => {
  const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -1.5, -2, 0.25, 1]
  expect(determinant(matrix)).toBe(1)
  const { position, quaternion, scale } = decompose(invert(matrix))
  expect(position).toEqual([1.5, 2, -0.25])
  expect(quaternion).toEqual([0, 0, 0, 1])
  expect(scale).toEqual([1, 1, 1])
})

test("Brasscap's skins read a parent-first rest rig and a rest height range", () => {
  const files = skinned()
  expect(files.length).toBeGreaterThan(0)
  for (const file of files) {
    const bytes = readFileSync(file)
    const names = jointNames(bytes)
    const rig = creatureRestRig(bytes, names)
    expect(rig.map(joint => joint.name).toSorted()).toEqual(
      [...names].toSorted(),
    )
    for (const [index, joint] of rig.entries()) {
      expect(joint.parent).toBeLessThan(index)
      for (const axis of joint.position) {
        expect(Number.isFinite(axis)).toBe(true)
      }
    }
    const bounds = creatureSkinBounds(bytes)
    expect(bounds.upper).toBeGreaterThan(bounds.lower)
  }
})

test('a rig whose expected joints differ from the skin is refused', () => {
  const [file] = skinned()
  const bytes = readFileSync(file ?? '')
  expect(() => creatureRestRig(bytes, ['nope'])).toThrow(
    'Creature rest rig needs one bounded skin',
  )
})
