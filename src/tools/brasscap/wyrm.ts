/* oxlint-disable eslint/no-magic-numbers, eslint/id-length, unicorn/numeric-separators-style, unicorn/number-literal-case, typescript/no-non-null-assertion, eslint/sort-vars, eslint/no-plusplus, typescript/explicit-function-return-type, eslint/max-params, eslint/max-statements, typescript/prefer-readonly-parameter-types, eslint/max-lines-per-function, node/no-sync, import/exports-last, import/group-exports, eslint/max-lines, typescript/explicit-member-accessibility, unicorn/max-nested-calls, eslint/no-shadow, eslint/curly, eslint/capitalized-comments, unicorn/no-array-for-each, unicorn/no-array-callback-reference -- Author-side model data, a stand-in for a Blender export: coordinates, colours and keyframes, never shipped or imported. */
// Brasscap Mesa (Template 2) Dust Wyrm, BM-5's model in meta
// TEMPLATE-E2E-PLAN. An author-side stand-in for the Blender export, like
// bandit.ts (BM-4): a flat-shaded, vertex-coloured low-poly skinned creature
// as one GLB, for a `platform.skin` look. A sand mound with a plated
// segmented body rising out of it (terracotta and cream plates, cream
// spines down its back), a blunt armoured head, and a jaw plate over a
// bright yellow gullet. About 1.9 m tall at scale 1 (the spawn scales it),
// its base at y = 0, facing +Z.
//
// Joints, in skin order: `body` (root, the lower segments), `neck`, `head`
// and `jaw` (the plate over the gullet), each a child of the one before;
// all four are sockets. The bind pose is unrotated and unscaled.
//
// Clips, linear keys on every joint's translation and rotation (every clip
// sets all four, so no pose leaks between clips):
//   `attack.rise`  the body heaves up out of the mound and rears back,
//   `attack.burst` it slams its head down into the sand (the sand-ring tell),
//   `attack.open`  it lifts its head and the jaw drops: the gullet is open
//                  (shipped for when engine can play a clip from a field;
//                  until then the open window shows as gullet particles),
//   `attack`       rise then burst, since engine plays `attack` across a
//                  strike's windup only and cancels it as the strike lands:
//                  the burst's slam meets the windup's end,
//   `idle`         a slow weave, the jaw shut; `hit` a recoil; `die` it
//                  sinks back under the sand.
//
// It also writes the skin file (`wyrm.skin.json`: the rig row, with the
// parsed cost, and its binding). The output is deterministic; wyrm.test.ts
// holds the committed files to it.
//   node src/tools/brasscap/wyrm.ts [out.glb] [out.skin.json]
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'

import { parseGlbData } from '../../format/glbCost.ts'

type V3 = readonly [number, number, number]
type Hex = number

const SAND = 0xd9a86a,
  SAND_SHADE = 0xbf8f55,
  TERRA = 0xb5532f,
  TERRA_SHADE = 0x93401f,
  CREAM = 0xeadcb8,
  CREAM_SHADE = 0xcdbb92,
  MAW = 0x2a1410,
  GULLET = 0xffd23a,
  GULLET_DEEP = 0xff9a1a

/** Joint indices, in the skin's joint order. */
const BODY = 0,
  NECK = 1,
  HEAD = 2,
  JAW = 3
/** World rest positions of the joints. */
export const BODY_AT: V3 = [0, 0.3, 0]
export const NECK_AT: V3 = [0, 0.85, 0]
export const HEAD_AT: V3 = [0, 1.35, 0]
/** The jaw hinges at the bottom front of the head. */
export const JAW_AT: V3 = [0, 1.38, 0.24]
const JOINTS = ['body', 'neck', 'head', 'jaw'] as const

export const WYRM_ID = 'brasscap.wyrm'
export const WYRM_CLIPS = [
  'idle',
  'attack',
  'attack.rise',
  'attack.burst',
  'attack.open',
  'hit',
  'die',
] as const
/** Seconds of the `attack` clip, rise then burst: the look's `attackSpan` (engine scales it to the strike's windup). */
export const ATTACK_SPAN = 1.5

function channel(v: number): number {
  const s = v / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
function linear(hex: Hex): [number, number, number] {
  return [
    channel(Math.floor(hex / 0x10000) % 256),
    channel(Math.floor(hex / 0x100) % 256),
    channel(hex % 256),
  ]
}
const f32 = (values: readonly number[]): Buffer =>
  Buffer.from(new Float32Array(values).buffer)
const bind = (p: V3): number[] => [
  1,
  0,
  0,
  0,
  0,
  1,
  0,
  0,
  0,
  0,
  1,
  0,
  -p[0],
  -p[1],
  -p[2],
  1,
]

/** Flat-shaded triangles, each wound outward from its part's centre and bound wholly to one joint. */
class Mesh {
  readonly pos: number[] = []
  readonly nor: number[] = []
  readonly col: number[] = []
  readonly joint: number[] = []
  tri(a: V3, b0: V3, c0: V3, hex: Hex, joint: number, centre: V3): void {
    const cross = (b: V3, c: V3): number[] => {
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
        w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
      return [
        u[1]! * w[2]! - u[2]! * w[1]!,
        u[2]! * w[0]! - u[0]! * w[2]!,
        u[0]! * w[1]! - u[1]! * w[0]!,
      ]
    }
    const first = cross(b0, c0),
      mid = [0, 1, 2].map(k => (a[k]! + b0[k]! + c0[k]!) / 3 - centre[k]!),
      inward =
        first[0]! * mid[0]! + first[1]! * mid[1]! + first[2]! * mid[2]! < 0,
      b = inward ? c0 : b0,
      c = inward ? b0 : c0,
      n = inward ? cross(b, c) : first
    const len = Math.hypot(n[0]!, n[1]!, n[2]!) || 1,
      rgb = linear(hex)
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2])
      this.nor.push(n[0]! / len, n[1]! / len, n[2]! / len)
      this.col.push(rgb[0], rgb[1], rgb[2])
      this.joint.push(joint)
    }
  }
  quad(a: V3, b: V3, c: V3, d: V3, hex: Hex, joint: number, centre: V3): void {
    this.tri(a, b, c, hex, joint, centre)
    this.tri(a, c, d, hex, joint, centre)
  }
  /** An axis-aligned box from its min corner and size. */
  box(at: V3, size: V3, hex: Hex, joint: number, top: Hex = hex): void {
    const [x0, y0, z0] = at,
      x1 = x0 + size[0],
      y1 = y0 + size[1],
      z1 = z0 + size[2],
      c: V3 = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]
    this.quad(
      [x0, y1, z0],
      [x1, y1, z0],
      [x1, y1, z1],
      [x0, y1, z1],
      top,
      joint,
      c,
    )
    this.quad(
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y0, z1],
      [x0, y0, z1],
      hex,
      joint,
      c,
    )
    this.quad(
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y1, z1],
      [x0, y1, z1],
      hex,
      joint,
      c,
    )
    this.quad(
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y1, z0],
      [x0, y1, z0],
      hex,
      joint,
      c,
    )
    this.quad(
      [x1, y0, z0],
      [x1, y0, z1],
      [x1, y1, z1],
      [x1, y1, z0],
      hex,
      joint,
      c,
    )
    this.quad(
      [x0, y0, z0],
      [x0, y0, z1],
      [x0, y1, z1],
      [x0, y1, z0],
      hex,
      joint,
      c,
    )
  }
  /** An upright octagonal frustum on the y axis (radius r0 at y0, r1 at y1); faces alternate two shades. */
  ring(
    r0: number,
    r1: number,
    y0: number,
    y1: number,
    hex: Hex,
    shade: Hex,
    joint: number,
    caps: boolean,
    z = 0,
  ): void {
    const sides = 8,
      centre: V3 = [0, (y0 + y1) / 2, z],
      at = (r: number, i: number): [number, number] => {
        const t = ((i + 0.5) / sides) * Math.PI * 2
        return [Math.sin(t) * r, Math.cos(t) * r + z]
      }
    for (let i = 0; i < sides; i++) {
      const [ax, az] = at(r0, i),
        [bx, bz] = at(r0, i + 1),
        [cx, cz] = at(r1, i + 1),
        [dx, dz] = at(r1, i)
      this.quad(
        [ax, y0, az],
        [bx, y0, bz],
        [cx, y1, cz],
        [dx, y1, dz],
        i % 2 === 0 ? hex : shade,
        joint,
        centre,
      )
      if (caps) {
        this.tri([0, y1, z], [dx, y1, dz], [cx, y1, cz], hex, joint, centre)
        this.tri([0, y0, z], [ax, y0, az], [bx, y0, bz], shade, joint, centre)
      }
    }
  }
  /** A spine: a three-sided spike from a base triangle round `at` to a tip. */
  spike(at: V3, tip: V3, r: number, hex: Hex, joint: number): void {
    const base: V3[] = [0, 1, 2].map(i => {
      const t = (i / 3) * Math.PI * 2
      return [at[0] + Math.sin(t) * r, at[1], at[2] + Math.cos(t) * r] as const
    })
    const centre: V3 = [
      (at[0] * 2 + tip[0]) / 3,
      (at[1] * 2 + tip[1]) / 3,
      (at[2] * 2 + tip[2]) / 3,
    ]
    for (let i = 0; i < 3; i++)
      this.tri(base[i]!, base[(i + 1) % 3]!, tip, hex, joint, centre)
    this.tri(base[0]!, base[1]!, base[2]!, hex, joint, centre)
  }
}

let mesh = new Mesh()

function wyrm(): void {
  // The sand mound it bursts from (on `body`, so it sinks with it on death only a little).
  mesh.ring(0.95, 0.7, 0, 0.14, SAND, SAND_SHADE, BODY, false)
  mesh.ring(0.7, 0.46, 0.14, 0.26, SAND, SAND_SHADE, BODY, true)
  // Lower segments: plated terracotta with cream bands.
  mesh.ring(0.44, 0.42, 0.1, 0.5, TERRA, TERRA_SHADE, BODY, false)
  mesh.ring(0.47, 0.47, 0.44, 0.52, CREAM, CREAM_SHADE, BODY, false)
  mesh.ring(0.41, 0.38, 0.5, 0.86, TERRA, TERRA_SHADE, BODY, false)
  mesh.ring(0.43, 0.43, 0.78, 0.86, CREAM, CREAM_SHADE, BODY, false)
  // Neck segments.
  mesh.ring(0.37, 0.34, 0.84, 1.12, TERRA, TERRA_SHADE, NECK, false)
  mesh.ring(0.39, 0.39, 1.04, 1.12, CREAM, CREAM_SHADE, NECK, false)
  mesh.ring(0.33, 0.32, 1.1, 1.36, TERRA, TERRA_SHADE, NECK, false)
  // Cream spines down the back (-Z).
  for (const [y, joint] of [
    [0.6, BODY],
    [0.95, NECK],
    [1.22, NECK],
  ] as const)
    mesh.spike([0, y, -0.34], [0, y + 0.12, -0.62], 0.07, CREAM, joint)
  // The head: an armoured terracotta block with a cream brow plate and crest.
  mesh.ring(0.34, 0.3, 1.34, 1.78, TERRA, TERRA_SHADE, HEAD, true, 0.04)
  mesh.box([-0.3, 1.66, -0.05], [0.6, 0.16, 0.42], CREAM, HEAD, CREAM_SHADE)
  mesh.spike([0, 1.8, -0.12], [0, 2.02, -0.42], 0.08, CREAM, HEAD)
  for (const x of [-0.22, 0.22])
    mesh.spike([x, 1.74, 0.1], [x * 1.6, 1.9, -0.18], 0.05, CREAM, HEAD)
  // The maw: a dark socket on the head's front with the yellow gullet deep in it.
  mesh.box([-0.22, 1.4, 0.3], [0.44, 0.3, 0.06], MAW, HEAD)
  mesh.box([-0.15, 1.45, 0.34], [0.3, 0.2, 0.04], GULLET_DEEP, HEAD)
  mesh.box([-0.1, 1.49, 0.37], [0.2, 0.12, 0.03], GULLET, HEAD)
  // The jaw plate over the maw, hinged at the bottom; cream teeth along its top edge.
  mesh.box([-0.27, 1.38, 0.4], [0.54, 0.36, 0.08], CREAM, JAW, CREAM_SHADE)
  for (const x of [-0.18, -0.06, 0.06, 0.18])
    mesh.spike([x, 1.72, 0.42], [x, 1.8, 0.43], 0.035, CREAM_SHADE, JAW)
}

type Quat = readonly [number, number, number, number]
const ID: Quat = [0, 0, 0, 1]
const rx = (t: number): Quat => [Math.sin(t / 2), 0, 0, Math.cos(t / 2)]
const ry = (t: number): Quat => [0, Math.sin(t / 2), 0, Math.cos(t / 2)]
const rz = (t: number): Quat => [0, 0, Math.sin(t / 2), Math.cos(t / 2)]

/** One joint's keys in a clip: local translations and rotations at the clip's times. */
interface JointKeys {
  readonly t: readonly V3[]
  readonly r: readonly Quat[]
}
interface Clip {
  readonly name: (typeof WYRM_CLIPS)[number]
  readonly times: readonly number[]
  /** body, neck, head, jaw */
  readonly keys: readonly [JointKeys, JointKeys, JointKeys, JointKeys]
}

const local = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const REST: readonly V3[] = [
  BODY_AT,
  local(NECK_AT, BODY_AT),
  local(HEAD_AT, NECK_AT),
  local(JAW_AT, HEAD_AT),
]
const up = (base: V3, dy: number, dz = 0): V3 => [
  base[0],
  base[1] + dy,
  base[2] + dz,
]
/** Keys for one joint: rest translation offsets (dy, dz) and rotations, per time. */
function joint(
  index: number,
  rotations: readonly Quat[],
  lifts: readonly (readonly [number, number])[] = rotations.map(() => [0, 0]),
): JointKeys {
  const rest = REST[index]!
  return { t: lifts.map(([dy, dz]) => up(rest, dy, dz)), r: rotations }
}
const still = (index: number, n: number): JointKeys =>
  joint(
    index,
    Array.from({ length: n }, () => ID),
  )

/** The jaw dropped: the plate swings down and forward off the gullet. */
const JAW_OPEN = rx(1.25)
const RISE = {
  times: [0, 0.6, 1.2],
  body: [ID, rx(-0.1), rx(-0.18)],
  bodyLift: [
    [0, 0],
    [0.18, 0],
    [0.3, 0],
  ] as const,
  neck: [ID, rx(-0.25), rx(-0.4)],
  head: [ID, rx(-0.15), rx(-0.3)],
}
const BURST = {
  times: [0, 0.12, 0.3],
  body: [rx(-0.18), rx(0.25), rx(0.2)],
  bodyLift: [
    [0.3, 0],
    [-0.05, 0.06],
    [-0.02, 0.04],
  ] as const,
  neck: [rx(-0.4), rx(0.55), rx(0.45)],
  head: [rx(-0.3), rx(0.4), rx(0.3)],
}
const OPEN = {
  times: [0, 0.3, 2.9],
  body: [rx(0.2), rx(-0.06), rx(-0.04)],
  bodyLift: [
    [-0.02, 0.04],
    [0.1, 0],
    [0.08, 0],
  ] as const,
  neck: [rx(0.45), rx(-0.08), rx(-0.06)],
  head: [rx(0.3), rx(-0.18), rx(-0.16)],
  jaw: [ID, JAW_OPEN, JAW_OPEN],
}
interface Part {
  readonly times: readonly number[]
  readonly body: readonly Quat[]
  readonly bodyLift: readonly (readonly [number, number])[]
  readonly neck: readonly Quat[]
  readonly head: readonly Quat[]
  readonly jaw?: readonly Quat[]
}
function part(name: Clip['name'], p: Part): Clip {
  const n = p.times.length
  return {
    name,
    times: p.times,
    keys: [
      joint(BODY, p.body, p.bodyLift),
      joint(NECK, p.neck),
      joint(HEAD, p.head),
      p.jaw === undefined ? still(JAW, n) : joint(JAW, p.jaw),
    ],
  }
}
/** `attack`: parts end to end (each part's first key is the last's end, so it is dropped). */
function chain(parts: readonly Part[]): Part {
  let offset = 0
  const out = {
    times: [] as number[],
    body: [] as Quat[],
    bodyLift: [] as (readonly [number, number])[],
    neck: [] as Quat[],
    head: [] as Quat[],
    jaw: [] as Quat[],
  }
  parts.forEach((p, k) => {
    const from = k === 0 ? 0 : 1
    for (let i = from; i < p.times.length; i++) {
      out.times.push(offset + p.times[i]!)
      out.body.push(p.body[i]!)
      out.bodyLift.push(p.bodyLift[i]!)
      out.neck.push(p.neck[i]!)
      out.head.push(p.head[i]!)
      out.jaw.push(p.jaw?.[i] ?? ID)
    }
    offset += p.times.at(-1)!
  })
  return out
}

const CLIPS: readonly Clip[] = [
  {
    name: 'idle',
    times: [0, 1.2, 2.4],
    keys: [
      joint(BODY, [rz(-0.05), rz(0.05), rz(-0.05)]),
      joint(NECK, [rx(-0.06), rx(0.06), rx(-0.06)]),
      joint(HEAD, [ry(-0.12), ry(0.12), ry(-0.12)]),
      still(JAW, 3),
    ],
  },
  part('attack', chain([RISE, BURST])),
  part('attack.rise', RISE),
  part('attack.burst', BURST),
  part('attack.open', OPEN),
  {
    name: 'hit',
    times: [0, 0.1, 0.45],
    keys: [
      joint(BODY, [ID, rx(-0.12), ID]),
      joint(NECK, [ID, rx(-0.25), ID]),
      joint(HEAD, [ID, rx(-0.2), ID]),
      joint(JAW, [ID, rx(0.4), ID]),
    ],
  },
  {
    name: 'die',
    times: [0, 0.4, 1.2, 1.8],
    keys: [
      // It sinks back into its mound, the mound with it: a buried Wyrm.
      joint(
        BODY,
        [ID, rx(-0.12), rx(0.18), rx(0.25)],
        [
          [0, 0],
          [0.12, 0],
          [-0.55, 0.05],
          [-0.95, 0.1],
        ],
      ),
      joint(NECK, [ID, rx(-0.3), rx(0.45), rx(0.6)]),
      joint(HEAD, [ID, rx(-0.4), rx(0.25), rx(0.35)]),
      joint(JAW, [ID, JAW_OPEN, JAW_OPEN, rx(0.6)]),
    ],
  },
]

/** Builds the Wyrm GLB from scratch; every call returns the same bytes. */
export function buildWyrm(): Buffer {
  mesh = new Mesh()
  wyrm()
  const chunks: Buffer[] = [],
    views: object[] = [],
    accessors: object[] = []
  let offset = 0
  const push = (bytes: Buffer, target?: number): number => {
    const pad = (4 - (bytes.length % 4)) % 4
    views.push({
      buffer: 0,
      byteOffset: offset,
      byteLength: bytes.length,
      ...(target === undefined ? {} : { target }),
    })
    chunks.push(Buffer.concat([bytes, Buffer.alloc(pad)]))
    offset += bytes.length + pad
    return views.length - 1
  }
  const acc = (
    view: number,
    type: string,
    componentType: number,
    count: number,
    extra: object = {},
  ): number => {
    accessors.push({ bufferView: view, componentType, count, type, ...extra })
    return accessors.length - 1
  }
  const inverseBinds = acc(
    push(f32([BODY_AT, NECK_AT, HEAD_AT, JAW_AT].flatMap(bind))),
    'MAT4',
    5126,
    JOINTS.length,
  )
  const count = mesh.pos.length / 3,
    min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < mesh.pos.length; i++) {
    min[i % 3] = Math.min(min[i % 3]!, mesh.pos[i]!)
    max[i % 3] = Math.max(max[i % 3]!, mesh.pos[i]!)
  }
  const joints: number[] = [],
    weights: number[] = []
  for (const j of mesh.joint) {
    joints.push(j, 0, 0, 0)
    weights.push(1, 0, 0, 0)
  }
  const position = acc(push(f32(mesh.pos), 34962), 'VEC3', 5126, count, {
    min,
    max,
  })
  const normal = acc(push(f32(mesh.nor), 34962), 'VEC3', 5126, count)
  const colour = acc(push(f32(mesh.col), 34962), 'VEC3', 5126, count)
  const joint = acc(
    push(Buffer.from(new Uint16Array(joints).buffer), 34962),
    'VEC4',
    5123,
    count,
  )
  const weight = acc(push(f32(weights), 34962), 'VEC4', 5126, count)
  const indices = acc(
    push(
      Buffer.from(
        new Uint32Array(Array.from({ length: count }, (_, i) => i)).buffer,
      ),
      34963,
    ),
    'SCALAR',
    5125,
    count,
  )
  const animations = CLIPS.map(clip => {
    const input = acc(
      push(f32(clip.times)),
      'SCALAR',
      5126,
      clip.times.length,
      { min: [clip.times[0]!], max: [clip.times.at(-1)!] },
    )
    const samplers: object[] = [],
      channels: object[] = []
    clip.keys.forEach((keys, j) => {
      for (const [path, values, type] of [
        ['translation', keys.t.flat(), 'VEC3'],
        ['rotation', keys.r.flat(), 'VEC4'],
      ] as const) {
        const output = acc(push(f32(values)), type, 5126, clip.times.length)
        samplers.push({ input, output, interpolation: 'LINEAR' })
        channels.push({
          sampler: samplers.length - 1,
          target: { node: j + 1, path },
        })
      }
    })
    return { name: clip.name, samplers, channels }
  })
  const bin = Buffer.concat(chunks)
  const json = {
    asset: {
      version: '2.0',
      generator: 'shardfile src/tools/brasscap/wyrm.ts (BM-5)',
    },
    scene: 0,
    scenes: [{ name: WYRM_ID, nodes: [0] }],
    nodes: [
      {
        name: WYRM_ID,
        extras: { castShadow: true },
        mesh: 0,
        skin: 0,
        children: [1],
      },
      { name: 'body', translation: [...REST[0]!], children: [2] },
      { name: 'neck', translation: [...REST[1]!], children: [3] },
      { name: 'head', translation: [...REST[2]!], children: [4] },
      { name: 'jaw', translation: [...REST[3]!] },
    ],
    skins: [
      {
        name: WYRM_ID,
        inverseBindMatrices: inverseBinds,
        joints: [1, 2, 3, 4],
      },
    ],
    meshes: [
      {
        name: WYRM_ID,
        primitives: [
          {
            attributes: {
              POSITION: position,
              NORMAL: normal,
              COLOR_0: colour,
              JOINTS_0: joint,
              WEIGHTS_0: weight,
            },
            indices,
            mode: 4,
            material: 0,
          },
        ],
      },
    ],
    materials: [
      {
        name: 'Plate',
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0.05,
          roughnessFactor: 0.8,
        },
      },
    ],
    animations,
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: bin.length }],
  }
  let text = Buffer.from(JSON.stringify(json))
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)])
  const header = Buffer.alloc(12),
    jh = Buffer.alloc(8),
    bh = Buffer.alloc(8)
  header.writeUInt32LE(0x46546c67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + text.length + 8 + bin.length, 8)
  jh.writeUInt32LE(text.length, 0)
  jh.writeUInt32LE(0x4e4f534a, 4)
  bh.writeUInt32LE(bin.length, 0)
  bh.writeUInt32LE(0x004e4942, 4)
  return Buffer.concat([header, jh, text, bh, bin])
}

/** Triangles in the last build, for the tool's report and the budget test. */
export function wyrmTriangles(): number {
  return mesh.pos.length / 9
}

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** The skin file (rig row and binding) for these GLB bytes, as the `platform.skin` look names it. */
export function buildWyrmSkin(glb: Buffer): Buffer {
  const cost = parseGlbData(glb)
  const file = {
    row: {
      cost: {
        decoded: cost.decoded,
        draws: cost.draws,
        gpu: cost.gpu,
        triangles: cost.triangles,
      },
      family: 'toon',
      file: sha256(glb),
      id: WYRM_ID,
      rig: {
        clips: [...WYRM_CLIPS],
        joints: [[...JOINTS]],
        skeleton: WYRM_ID,
        sockets: [...JOINTS],
      },
    },
    binding: {
      loops: ['idle'],
      material: {
        envStrength: 0.6,
        family: 'pbr',
        metalness: 0.05,
        occlusion: 0,
        roughness: 0.8,
        vertexColours: true,
      },
      skin: WYRM_ID,
    },
  }
  return Buffer.from(JSON.stringify(file))
}

if (process.argv[1] === import.meta.filename) {
  const out = process.argv[2] ?? 'corpus/sources/brasscap-mesa/wyrm.glb',
    skinOut = process.argv[3] ?? 'corpus/sources/brasscap-mesa/wyrm.skin.json',
    file = buildWyrm(),
    skin = buildWyrmSkin(file)
  writeFileSync(out, file)
  writeFileSync(skinOut, skin)
  process.stdout.write(
    `${out}: ${file.length} bytes, ${wyrmTriangles()} triangles, sha256 ${sha256(file)}\n${skinOut}: ${skin.length} bytes, sha256 ${sha256(skin)}\n`,
  )
}
