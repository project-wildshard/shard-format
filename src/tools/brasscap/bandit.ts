/* oxlint-disable eslint/no-magic-numbers, eslint/id-length, unicorn/numeric-separators-style, unicorn/number-literal-case, typescript/no-non-null-assertion, eslint/sort-vars, eslint/no-plusplus, typescript/explicit-function-return-type, eslint/max-params, eslint/max-statements, unicorn/no-zero-fractions, typescript/prefer-readonly-parameter-types, eslint/max-lines-per-function, node/no-sync, import/exports-last, import/group-exports, eslint/max-lines, typescript/explicit-member-accessibility, unicorn/max-nested-calls -- Author-side model data, a stand-in for a Blender export: coordinates, colours and keyframes, never shipped or imported. */
// Brasscap Mesa (Template 2) tin bandit, BM-4's asset half in meta
// TEMPLATE-E2E-PLAN. An author-side stand-in for the Blender export, like
// canyon.ts (BM-1) and rifle.ts (BM-3): a flat-shaded, vertex-coloured
// low-poly skinned creature as one GLB, for a `platform.skin` look. A tin can
// body with brass rim bands, stubby legs and arms, a smaller tin head with
// one bright yellow eye, a red bandana over the lower face and a black
// stovepipe hat with a brass band. About 1.45 m tall, feet at y = 0, facing
// +Z (as the template's skins do).
//
// The rig is the template grey-blob's shape: a mesh node with one skin, the
// joints `body` (root) and `head` (its child), both sockets; the bind pose is
// unrotated and unscaled. Clips, linear keys on both joints' translation and
// rotation (every clip sets both, so no pose leaks between clips): `idle`,
// `walk` (a waddle), `attack` (a lunge), `hit` (a recoil) and `die` (falls
// over backwards onto the ground: the bandit's fall).
//
// It also writes the skin file (`bandit.skin.json`: the rig row, with the
// parsed cost, and its binding). The output is deterministic; bandit.test.ts
// holds the committed files to it.
//   node src/tools/brasscap/bandit.ts [out.glb] [out.skin.json]
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'

import { parseGlbData } from '../../format/glbCost.ts'

type V3 = readonly [number, number, number]
type Hex = number

const TIN = 0xb9bec4,
  TIN_SHADE = 0x9aa1a8,
  TIN_LIGHT = 0xd2d6da,
  BRASS = 0xc9a227,
  BRASS_DARK = 0x9c7a1c,
  STEEL = 0x5a6068,
  BOOT = 0x3b2a1e,
  HAT = 0x1c1a1a,
  HAT_SHADE = 0x2a2626,
  BANDANA = 0xc0302a,
  BANDANA_DARK = 0x9a2420,
  EYE = 0xffe14a

/** Joint indices, in the skin's joint order. */
const BODY = 0,
  HEAD = 1
/** World rest positions of the joints (the body's pivot at the can's middle, the head's at its neck). */
export const BODY_AT: V3 = [0, 0.62, 0]
export const HEAD_AT: V3 = [0, 1.0, 0]

export const BANDIT_ID = 'brasscap.bandit'
export const BANDIT_CLIPS = ['idle', 'walk', 'attack', 'hit', 'die'] as const

/** One sRGB byte as a linear 0..1 channel (glTF COLOR_0 is linear). */
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
/** A joint's inverse bind: a pure translation (column-major), so the bind pose is unrotated and unscaled. */
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
      centre: V3 = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]
    this.quad(
      [x0, y1, z0],
      [x1, y1, z0],
      [x1, y1, z1],
      [x0, y1, z1],
      top,
      joint,
      centre,
    )
    this.quad(
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y0, z1],
      [x0, y0, z1],
      hex,
      joint,
      centre,
    )
    this.quad(
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y1, z1],
      [x0, y1, z1],
      hex,
      joint,
      centre,
    )
    this.quad(
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y1, z0],
      [x0, y1, z0],
      hex,
      joint,
      centre,
    )
    this.quad(
      [x1, y0, z0],
      [x1, y0, z1],
      [x1, y1, z1],
      [x1, y1, z0],
      hex,
      joint,
      centre,
    )
    this.quad(
      [x0, y0, z0],
      [x0, y0, z1],
      [x0, y1, z1],
      [x0, y1, z0],
      hex,
      joint,
      centre,
    )
  }
  /** An upright octagonal can on the y axis; `caps` false leaves a band open top and bottom. Faces alternate two shades. */
  can(
    r: number,
    y0: number,
    y1: number,
    hex: Hex,
    shade: Hex,
    joint: number,
    caps = true,
    cap: Hex = hex,
  ): void {
    const sides = 8,
      centre: V3 = [0, (y0 + y1) / 2, 0],
      ring = Array.from({ length: sides }, (_, i): [number, number] => {
        const t = ((i + 0.5) / sides) * Math.PI * 2
        return [Math.sin(t) * r, Math.cos(t) * r]
      })
    for (let i = 0; i < sides; i++) {
      const [ax, az] = ring[i]!,
        [bx, bz] = ring[(i + 1) % sides]!
      this.quad(
        [ax, y0, az],
        [bx, y0, bz],
        [bx, y1, bz],
        [ax, y1, az],
        i % 2 === 0 ? hex : shade,
        joint,
        centre,
      )
      if (caps) {
        this.tri([0, y1, 0], [ax, y1, az], [bx, y1, bz], cap, joint, centre)
        this.tri([0, y0, 0], [ax, y0, az], [bx, y0, bz], shade, joint, centre)
      }
    }
  }
}

let mesh = new Mesh()

function bandit(): void {
  // Boots and stubby legs.
  for (const x of [-0.2, 0.08]) {
    mesh.box([x, 0, -0.08], [0.12, 0.09, 0.24], BOOT, BODY)
    mesh.box([x + 0.015, 0.09, -0.03], [0.09, 0.33, 0.09], STEEL, BODY)
  }
  // The can: tin with brass rims at its foot and lip.
  mesh.can(0.3, 0.42, 0.94, TIN, TIN_SHADE, BODY, true, TIN_LIGHT)
  mesh.can(0.318, 0.42, 0.48, BRASS, BRASS_DARK, BODY, false)
  mesh.can(0.318, 0.88, 0.94, BRASS, BRASS_DARK, BODY, false)
  // Arms hang at the sides.
  mesh.box([-0.4, 0.5, -0.06], [0.1, 0.36, 0.12], STEEL, BODY)
  mesh.box([0.3, 0.5, -0.06], [0.1, 0.36, 0.12], STEEL, BODY)
  // The head: a smaller tin can, a red bandana over its lower half with a flap in front, one yellow eye.
  mesh.can(0.22, 0.94, 1.2, TIN, TIN_SHADE, HEAD)
  mesh.can(0.235, 0.95, 1.04, BANDANA, BANDANA_DARK, HEAD, false)
  mesh.tri(
    [-0.12, 1.0, 0.232],
    [0.12, 1.0, 0.232],
    [0, 0.86, 0.26],
    BANDANA,
    HEAD,
    [0, 0.95, 0],
  )
  mesh.box([-0.06, 1.08, 0.19], [0.12, 0.07, 0.07], EYE, HEAD)
  // The stovepipe hat: a wide brim, a tall crown and a brass band.
  mesh.can(0.34, 1.2, 1.24, HAT, HAT_SHADE, HEAD)
  mesh.can(0.19, 1.24, 1.46, HAT, HAT_SHADE, HEAD, true, HAT_SHADE)
  mesh.can(0.198, 1.25, 1.3, BRASS, BRASS_DARK, HEAD, false)
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
  readonly name: (typeof BANDIT_CLIPS)[number]
  readonly times: readonly number[]
  readonly body: JointKeys
  readonly head: JointKeys
}

const B: V3 = BODY_AT
const H: V3 = [
  HEAD_AT[0] - BODY_AT[0],
  HEAD_AT[1] - BODY_AT[1],
  HEAD_AT[2] - BODY_AT[2],
]
const at = (base: V3, dx: number, dy: number, dz: number): V3 => [
  base[0] + dx,
  base[1] + dy,
  base[2] + dz,
]

/** The body lies on its back once it has fallen: the hat's brim (0.34 m) touches the ground. */
const FALLEN_Y = 0.34

const CLIPS: readonly Clip[] = [
  {
    name: 'idle',
    times: [0, 1, 2],
    body: { t: [B, at(B, 0, 0.02, 0), B], r: [ID, ID, ID] },
    head: { t: [H, H, H], r: [ry(-0.12), ry(0.12), ry(-0.12)] },
  },
  {
    name: 'walk',
    times: [0, 0.2, 0.4, 0.6, 0.8],
    body: {
      t: [B, at(B, 0, 0.05, 0), B, at(B, 0, 0.05, 0), B],
      r: [rz(0.14), ID, rz(-0.14), ID, rz(0.14)],
    },
    head: { t: [H, H, H, H, H], r: [rz(-0.08), ID, rz(0.08), ID, rz(-0.08)] },
  },
  {
    name: 'attack',
    times: [0, 0.25, 0.6],
    body: { t: [B, at(B, 0, -0.04, 0.28), B], r: [ID, rx(0.5), ID] },
    head: { t: [H, H, H], r: [ID, rx(0.2), ID] },
  },
  {
    name: 'hit',
    times: [0, 0.1, 0.4],
    body: { t: [B, at(B, 0, 0, -0.12), B], r: [ID, rx(-0.32), ID] },
    head: { t: [H, H, H], r: [ID, rx(-0.3), ID] },
  },
  {
    name: 'die',
    times: [0, 0.3, 0.7, 1],
    body: {
      t: [B, at(B, 0, 0, -0.05), at(B, 0, -0.18, -0.2), [0, FALLEN_Y, -0.3]],
      r: [ID, rx(-0.4), rx(-1.35), rx(-Math.PI / 2)],
    },
    head: { t: [H, H, H, H], r: [ID, rx(-0.25), rx(-0.1), ID] },
  },
]

/** Builds the bandit GLB from scratch; every call returns the same bytes. */
export function buildBandit(): Buffer {
  mesh = new Mesh()
  bandit()
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
  // Accessor 0: the joints' inverse binds.
  const inverseBinds = acc(
    push(f32([...bind(BODY_AT), ...bind(HEAD_AT)])),
    'MAT4',
    5126,
    2,
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
      {
        min: [clip.times[0]!],
        max: [clip.times.at(-1)!],
      },
    )
    const samplers: object[] = [],
      channels: object[] = []
    for (const [node, keys] of [
      [1, clip.body],
      [2, clip.head],
    ] as const) {
      for (const [path, values, type] of [
        ['translation', keys.t.flat(), 'VEC3'],
        ['rotation', keys.r.flat(), 'VEC4'],
      ] as const) {
        const output = acc(push(f32(values)), type, 5126, clip.times.length)
        samplers.push({ input, output, interpolation: 'LINEAR' })
        channels.push({ sampler: samplers.length - 1, target: { node, path } })
      }
    }
    return { name: clip.name, samplers, channels }
  })
  const bin = Buffer.concat(chunks)
  const json = {
    asset: {
      version: '2.0',
      generator: 'shardfile src/tools/brasscap/bandit.ts (BM-4)',
    },
    scene: 0,
    scenes: [{ name: BANDIT_ID, nodes: [0] }],
    nodes: [
      {
        name: BANDIT_ID,
        extras: { castShadow: true },
        mesh: 0,
        skin: 0,
        children: [1],
      },
      { name: 'body', translation: [...BODY_AT], children: [2] },
      { name: 'head', translation: [...H] },
    ],
    skins: [
      { name: BANDIT_ID, inverseBindMatrices: inverseBinds, joints: [1, 2] },
    ],
    meshes: [
      {
        name: BANDIT_ID,
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
        name: 'Tin',
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0.25,
          roughnessFactor: 0.55,
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
export function banditTriangles(): number {
  return mesh.pos.length / 9
}

/** The content hash a file of these bytes is addressed by. */
export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** The skin file (rig row and binding) for these GLB bytes, as the `platform.skin` look names it. */
export function buildBanditSkin(glb: Buffer): Buffer {
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
      id: BANDIT_ID,
      rig: {
        clips: [...BANDIT_CLIPS],
        joints: [['body', 'head']],
        skeleton: BANDIT_ID,
        sockets: ['body', 'head'],
      },
    },
    binding: {
      loops: ['idle', 'walk'],
      material: {
        envStrength: 0.8,
        family: 'pbr',
        metalness: 0.25,
        occlusion: 0,
        roughness: 0.55,
        vertexColours: true,
      },
      skin: BANDIT_ID,
    },
  }
  return Buffer.from(JSON.stringify(file))
}

if (process.argv[1] === import.meta.filename) {
  const out = process.argv[2] ?? 'corpus/sources/brasscap-mesa/bandit.glb',
    skinOut =
      process.argv[3] ?? 'corpus/sources/brasscap-mesa/bandit.skin.json',
    file = buildBandit(),
    skin = buildBanditSkin(file)
  writeFileSync(out, file)
  writeFileSync(skinOut, skin)
  process.stdout.write(
    `${out}: ${file.length} bytes, ${banditTriangles()} triangles, sha256 ${sha256(file)}\n${skinOut}: ${skin.length} bytes, sha256 ${sha256(skin)}\n`,
  )
}
