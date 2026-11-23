/* oxlint-disable id-length, import/exports-last, import/no-namespace, max-statements, no-magic-numbers, no-plusplus, prefer-destructuring, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls, unicorn/no-array-reduce -- a port of engine's GLB rest reading and three.js 0.186's matrix steps (SHARD-COMPAT PR6a), kept term for term so the values match the engine byte for byte */
// SHARD-COMPAT PR6a (J487): a creature skin's rest height, read from its admitted GLB with format code only, so the MMO
// server and the cook compute giant heights without engine code. Moved verbatim from engine
// `src/shared/game/shardfile/creatureSkinBounds.ts`: rest geometry as the skin instance draws it.
import * as v from 'valibot'

import { glbBuffers } from './glbBuffers.ts'
import { parseGlbData } from './glbCost.ts'

const MAX_COUNT = 4_000_000
const FLOAT = 5126
const SHORT = 5122
const FLOAT_BYTES = 4
const SHORT_BYTES = 2
const AXES = 3
const SHORT_MAX = 32_767
const HEADER = 20
const CHUNK = 8
const JSON_LENGTH_AT = 12

const count = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(0),
  v.maxValue(MAX_COUNT),
)
const Doc = v.looseObject({
  nodes: v.array(
    v.object({ mesh: v.optional(count), skin: v.optional(count) }),
  ),
  meshes: v.array(
    v.object({
      primitives: v.array(
        v.object({ attributes: v.object({ POSITION: count }) }),
      ),
    }),
  ),
  accessors: v.array(v.unknown()),
})
const Accessor = v.object({
  bufferView: count,
  byteOffset: v.optional(count, 0),
  componentType: v.picklist([FLOAT, SHORT]),
  type: v.literal('VEC3'),
  count,
  normalized: v.optional(v.boolean(), false),
})
const View = v.object({
  byteOffset: v.optional(count, 0),
  byteStride: v.optional(count),
  byteLength: count,
})

type GlbDoc = v.InferOutput<typeof Doc>
type Primitive = GlbDoc['meshes'][number]['primitives'][number]

/** A skin's rest height range: the lowest and highest Y its vertices reach. */
export interface SkinBounds {
  readonly lower: number
  readonly upper: number
}

interface Stream {
  readonly binary: DataView
  readonly views: readonly unknown[]
  readonly accessors: readonly unknown[]
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

/** One primitive's Y range, folded into `bounds`. */
function primitiveBounds(
  stream: Stream,
  primitive: Primitive,
  bounds: SkinBounds,
): SkinBounds {
  const accessor = v.parse(
    Accessor,
    stream.accessors[primitive.attributes.POSITION],
  )
  const view = v.parse(View, stream.views[accessor.bufferView])
  const width = accessor.componentType === FLOAT ? FLOAT_BYTES : SHORT_BYTES
  const stride = view.byteStride ?? width * AXES
  if (
    stride < width * AXES ||
    accessor.byteOffset + (accessor.count - 1) * stride + width * AXES >
      view.byteLength
  ) {
    throw new Error('Invalid creature position bounds')
  }
  let { lower, upper } = bounds
  for (let index = 0; index < accessor.count; index++) {
    const at = view.byteOffset + accessor.byteOffset + index * stride + width
    const raw =
      width === FLOAT_BYTES
        ? stream.binary.getFloat32(at, true)
        : stream.binary.getInt16(at, true)
    const y =
      width === SHORT_BYTES && accessor.normalized
        ? Math.max(raw / SHORT_MAX, -1)
        : raw
    lower = Math.min(lower, y)
    upper = Math.max(upper, y)
  }
  return { lower, upper }
}

/** Rest geometry as the skin instance draws it: static-prop triangle visitors refuse deforming skins, so this reads
 * the admitted position streams directly. */
export function creatureSkinBounds(bytes: Uint8Array): SkinBounds {
  const { doc, length } = glbDoc(bytes)
  const nodes = doc.nodes.filter(
    node => node.skin !== undefined && node.mesh !== undefined,
  )
  const node = nodes[0]
  const mesh = node?.mesh === undefined ? undefined : doc.meshes[node.mesh]
  if (nodes.length !== 1 || mesh === undefined) {
    throw new Error('Creature bounds need one admitted skin')
  }
  const data = glbBuffers(doc, bytes.subarray(HEADER + CHUNK + length))
  const binary = new DataView(
    data.bytes.buffer,
    data.bytes.byteOffset,
    data.bytes.byteLength,
  )
  const stream = { binary, views: data.views, accessors: doc.accessors }
  return mesh.primitives.reduce<SkinBounds>(
    (bounds, primitive) => primitiveBounds(stream, primitive, bounds),
    {
      lower: 0,
      upper: 0,
    },
  )
}
