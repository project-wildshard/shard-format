/* oxlint-disable id-length, import/exports-last, import/no-namespace, max-params, max-statements, no-magic-numbers, no-use-before-define, prefer-destructuring, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls -- a port of engine's GLB rest reading and three.js 0.186's matrix steps (SHARD-COMPAT PR6a), kept term for term so the values match the engine byte for byte */
// SHARD-COMPAT PR6a (J487): a creature skin's rest rig (each joint's parent and its rest offset from that parent),
// read from the admitted GLB with format code only, so the MMO server builds hit volumes, sockets and giant heights
// without engine code. Moved from engine `src/shared/game/shardfile/creatureRestRig.ts` (three's matrices replaced by
// `mat4.ts`, the same arithmetic): the position-only inverse-bind rest contract, meshopt buffer views included.
import * as v from 'valibot'

import { glbBuffers } from './glbBuffers.ts'
import { parseGlbData } from './glbCost.ts'
import { decompose, determinant, invert } from './mat4.ts'

/** One rest joint: its name, its parent's index in the rig (-1 at a root) and its offset from that parent. */
export interface CreatureRestJoint {
  readonly name: string
  readonly parent: number
  readonly position: readonly [number, number, number]
}

const MAX_COUNT = 4_000_000
const MAX_JOINTS = 32
const MAT4_BYTES = 64
const FLOAT_BYTES = 4
const FLOAT = 5126
const ELEMENTS = 16
const HEADER = 20
const CHUNK = 8
const JSON_LENGTH_AT = 12
const SINGULAR = 1e-12
const UNIT = 1e-5

const count = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(0),
  v.maxValue(MAX_COUNT),
)
const Doc = v.looseObject({
  nodes: v.array(
    v.object({
      name: v.optional(v.string()),
      children: v.optional(v.array(count), []),
      skin: v.optional(count),
      mesh: v.optional(count),
    }),
  ),
  skins: v.array(
    v.object({ joints: v.array(count), inverseBindMatrices: count }),
  ),
  accessors: v.array(v.unknown()),
})
const Accessor = v.object({
  bufferView: count,
  byteOffset: v.optional(count, 0),
  componentType: v.literal(FLOAT),
  type: v.literal('MAT4'),
  count,
})
const View = v.object({
  byteOffset: v.optional(count, 0),
  byteStride: v.optional(count, MAT4_BYTES),
  byteLength: count,
})

type GlbDoc = v.InferOutput<typeof Doc>
type Vec3 = readonly [number, number, number]

interface Joints {
  readonly order: readonly number[]
  readonly names: ReadonlyMap<number, string>
  readonly positions: ReadonlyMap<number, Vec3>
  readonly parents: ReadonlyMap<number, number>
}

function glbDoc(bytes: Uint8Array): {
  readonly doc: GlbDoc
  readonly length: number
} {
  parseGlbData(bytes)
  const length = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getUint32(JSON_LENGTH_AT, true)
  const text = new TextDecoder().decode(bytes.subarray(HEADER, HEADER + length))
  return { doc: v.parse(Doc, JSON.parse(text)), length }
}

/** The one skinned mesh's skin, bounded and in the expected joint count. */
function oneSkin(
  doc: GlbDoc,
  expected: readonly string[],
): GlbDoc['skins'][number] {
  const meshes = doc.nodes.filter(
    node => node.skin !== undefined && node.mesh !== undefined,
  )
  const mesh = meshes[0]
  const skin = mesh?.skin === undefined ? undefined : doc.skins[mesh.skin]
  if (
    meshes.length !== 1 ||
    skin === undefined ||
    skin.joints.length !== expected.length ||
    skin.joints.length > MAX_JOINTS
  ) {
    throw new Error('Creature rest rig needs one bounded skin')
  }
  return skin
}

/** Each node's one parent. */
function parentsOf(doc: GlbDoc): ReadonlyMap<number, number> {
  const parents = new Map<number, number>()
  for (const [parent, node] of doc.nodes.entries()) {
    for (const child of node.children) {
      if (parents.has(child)) {
        throw new Error('Ambiguous creature rest parent')
      }
      parents.set(child, parent)
    }
  }
  return parents
}

/** A joint's rest position: the translation of its inverse bind's inverse, which must be unrotated and unscaled. */
function restPosition(binary: DataView, at: number): Vec3 {
  const matrix = Array.from({ length: ELEMENTS }, (_, field) =>
    binary.getFloat32(at + field * FLOAT_BYTES, true),
  )
  if (Math.abs(determinant(matrix)) < SINGULAR) {
    throw new Error('Singular creature inverse bind')
  }
  const { position, quaternion, scale } = decompose(invert(matrix))
  const [sx, sy, sz] = scale
  if (
    Math.abs(Math.abs(quaternion[3]) - 1) > UNIT ||
    Math.abs(sx - 1) + Math.abs(sy - 1) + Math.abs(sz - 1) > UNIT
  ) {
    throw new Error('Creature bind pose must be unrotated and unscaled')
  }
  return position
}

/** Every skin joint's name and rest position, in skin order. */
function readJoints(bytes: Uint8Array, expected: readonly string[]): Joints {
  const { doc, length } = glbDoc(bytes)
  const skin = oneSkin(doc, expected)
  const data = glbBuffers(doc, bytes.subarray(HEADER + CHUNK + length))
  const accessor = v.parse(Accessor, doc.accessors[skin.inverseBindMatrices])
  const view = v.parse(View, data.views[accessor.bufferView])
  if (
    accessor.count !== skin.joints.length ||
    view.byteStride < MAT4_BYTES ||
    accessor.byteOffset + (accessor.count - 1) * view.byteStride + MAT4_BYTES >
      view.byteLength
  ) {
    throw new Error('Invalid creature inverse binds')
  }
  const binary = new DataView(
    data.bytes.buffer,
    data.bytes.byteOffset,
    data.bytes.byteLength,
  )
  const names = new Map<number, string>()
  const positions = new Map<number, Vec3>()
  for (const [index, node] of skin.joints.entries()) {
    const name = doc.nodes[node]?.name
    if (
      name === undefined ||
      name !== expected[index] ||
      names.has(node) ||
      [...names.values()].includes(name)
    ) {
      throw new Error('Creature rest joint order differs from skin')
    }
    names.set(node, name)
    positions.set(
      node,
      restPosition(
        binary,
        view.byteOffset + accessor.byteOffset + index * view.byteStride,
      ),
    )
  }
  return { order: skin.joints, names, positions, parents: parentsOf(doc) }
}

/** The rig in parent-first order, each position relative to its parent joint. */
function ordered(joints: Joints): readonly CreatureRestJoint[] {
  const result: CreatureRestJoint[] = []
  const indices = new Map<number, number>()
  const visiting = new Set<number>()
  const append = (node: number): number => {
    const previous = indices.get(node)
    if (previous !== undefined) {
      return previous
    }
    if (visiting.has(node)) {
      throw new Error('Cyclic creature rest rig')
    }
    visiting.add(node)
    const parentNode = joints.parents.get(node)
    const parent =
      parentNode !== undefined && joints.names.has(parentNode)
        ? append(parentNode)
        : -1
    const index = result.length
    result.push(
      restJoint(joints, node, parent === -1 ? undefined : parentNode, parent),
    )
    indices.set(node, index)
    visiting.delete(node)
    return index
  }
  for (const node of joints.order) {
    append(node)
  }
  return result
}

function restJoint(
  joints: Joints,
  node: number,
  parentNode: number | undefined,
  parent: number,
): CreatureRestJoint {
  const position = joints.positions.get(node)
  const name = joints.names.get(node)
  if (position === undefined || name === undefined) {
    throw new Error('Missing creature rest joint')
  }
  const [px, py, pz] =
    parentNode === undefined
      ? [0, 0, 0]
      : (joints.positions.get(parentNode) ?? [0, 0, 0])
  const [x, y, z] = position
  return {
    name,
    parent,
    position: parentNode === undefined ? [x, y, z] : [x - px, y - py, z - pz],
  }
}

/** The same position-only inverse-bind rest contract as engine's client skins, without a renderer. */
export function creatureRestRig(
  bytes: Uint8Array,
  expected: readonly string[],
): readonly CreatureRestJoint[] {
  return ordered(readJoints(bytes, expected))
}
