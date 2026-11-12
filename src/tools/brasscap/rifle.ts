/* oxlint-disable eslint/no-magic-numbers, eslint/id-length, unicorn/numeric-separators-style, unicorn/number-literal-case, typescript/no-non-null-assertion, eslint/capitalized-comments, eslint/no-inline-comments, eslint/sort-vars, eslint/no-plusplus, eslint/curly, typescript/explicit-function-return-type, eslint/max-params, eslint/max-statements, unicorn/no-zero-fractions, typescript/prefer-readonly-parameter-types, eslint/max-lines-per-function, node/no-sync, import/exports-last, import/group-exports, eslint/max-lines, typescript/explicit-member-accessibility, unicorn/max-nested-calls -- Author-side model data, a stand-in for a Blender export: coordinates and colours, never shipped or imported. */
// Brasscap Mesa (Template 2) lever-action rifle, BM-3's asset half in meta
// TEMPLATE-E2E-PLAN. An author-side stand-in for the Blender export, like
// canyon.ts (BM-1): a flat-shaded, vertex-coloured low-poly rifle as one GLB,
// walnut stock and fore-end, brass receiver and lever loop, a blued octagonal
// barrel over its magazine tube. Two primitives: matte (wood, steel) and brass.
// The rifle lies along -Z (the muzzle forward, as a camera-held model points),
// +Y up, the origin at the receiver. Named empties: `muzzle` at the barrel's
// tip, `grip` at the wrist and `fore` under the fore-end, where hands go.
// The output is deterministic (no random numbers); rifle.test.ts holds the
// committed GLB to it.
//   node src/tools/brasscap/rifle.ts [out.glb]
import { writeFileSync } from 'node:fs'

import { Geo } from './canyon.ts'

type V3 = readonly [number, number, number]
type Hex = number

const WALNUT = 0x6b3a1f,
  WALNUT_DARK = 0x52301b,
  BRASS = 0xc9a227,
  BRASS_LIGHT = 0xe0b830,
  BRASS_DARK = 0x9c7a1c,
  BLUED = 0x2f3338,
  STEEL = 0x454b52,
  BUTT_PLATE = 0x3a2a20

/** The barrel's tip, where rounds and the flash leave. */
export const MUZZLE: V3 = [0, 0.028, -0.74]
const GRIP: V3 = [0, -0.035, 0.14]
const FORE: V3 = [0, -0.02, -0.26]

const sub = (a: V3, b: V3): [number, number, number] => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
]
function centroid(points: readonly V3[]): V3 {
  let x = 0,
    y = 0,
    z = 0
  for (const p of points) {
    x += p[0]
    y += p[1]
    z += p[2]
  }
  return [x / points.length, y / points.length, z / points.length]
}

/** A convex part's faces, each wound so its normal points away from the part's centre. */
class Part {
  readonly g: Geo
  readonly centre: V3
  constructor(g: Geo, centre: V3) {
    this.g = g
    this.centre = centre
  }
  face(points: readonly V3[], hex: Hex): void {
    const c = centroid(points),
      u = sub(points[1]!, points[0]!),
      w = sub(points[2]!, points[0]!)
    const n: V3 = [
      u[1] * w[2] - u[2] * w[1],
      u[2] * w[0] - u[0] * w[2],
      u[0] * w[1] - u[1] * w[0],
    ]
    const out = sub(c, this.centre),
      flip = n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0
    const ring = flip ? points.toReversed() : points
    for (let i = 1; i + 1 < ring.length; i++)
      this.g.tri(ring[0]!, ring[i]!, ring[i + 1]!, hex)
  }
}

/**
 * A hexahedron from its eight corners: the back face (b0..b3) then the front (f0..f3), each ring in the same order.
 * Faces are oriented outward from the centre, so the corner order only needs to go round.
 */
function hexa(
  g: Geo,
  back: readonly [V3, V3, V3, V3],
  front: readonly [V3, V3, V3, V3],
  side: Hex,
  top: Hex = side,
  cap: Hex = side,
): void {
  const part = new Part(g, centroid([...back, ...front]))
  part.face(back, cap)
  part.face(front, cap)
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      quad = [back[i]!, back[j]!, front[j]!, front[i]!]
    // The face whose corners sit highest takes the top colour.
    const up = quad.every(p => p[1] >= centroid([...back, ...front])[1])
    part.face(quad, up ? top : side)
  }
}

/** An axis-aligned box from its centre and size. */
function box(g: Geo, c: V3, s: V3, side: Hex, top: Hex = side): void {
  const [x0, x1] = [c[0] - s[0] / 2, c[0] + s[0] / 2],
    [y0, y1] = [c[1] - s[1] / 2, c[1] + s[1] / 2],
    [z0, z1] = [c[2] - s[2] / 2, c[2] + s[2] / 2]
  hexa(
    g,
    [
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y1, z1],
      [x0, y1, z1],
    ],
    [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y1, z0],
      [x0, y1, z0],
    ],
    side,
    top,
  )
}

/** A tube along Z: a regular polygon of `sides` round (x, y), from z0 back to z1 forward, capped. */
function tube(
  g: Geo,
  x: number,
  y: number,
  r: number,
  z0: number,
  z1: number,
  sides: number,
  hex: Hex,
  cap: Hex = hex,
): void {
  const ring = (z: number): V3[] =>
    Array.from({ length: sides }, (_, i) => {
      const a = (i / sides) * Math.PI * 2 + Math.PI / sides
      return [x + Math.cos(a) * r, y + Math.sin(a) * r, z] as const
    })
  const back = ring(z0),
    front = ring(z1),
    part = new Part(g, [x, y, (z0 + z1) / 2])
  part.face(back, cap)
  part.face(front, cap)
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides
    part.face([back[i]!, back[j]!, front[j]!, front[i]!], hex)
  }
}

/** The lever loop: four bars round a finger hole, under the receiver. */
function lever(g: Geo): void {
  const w = 0.012,
    t = 0.01
  box(g, [0, -0.052, 0.03], [w, t, 0.05], BRASS) // front tang under the receiver
  box(g, [0, -0.075, 0.075], [w, 0.055, t], BRASS) // front of the loop
  box(g, [0, -0.105, 0.115], [w, t, 0.09], BRASS) // bottom of the loop
  box(g, [0, -0.08, 0.158], [w, 0.05, t], BRASS) // back of the loop
  box(g, [0, -0.055, 0.17], [w, t, 0.03], BRASS) // back into the wrist
  box(g, [0, -0.05, 0.095], [0.006, 0.03, 0.006], STEEL) // the trigger
}

let matte = new Geo(),
  brass = new Geo()
function rifle(): void {
  // Butt stock: a tall walnut wedge narrowing to the wrist, with a dark butt plate.
  hexa(
    matte,
    [
      [-0.022, -0.15, 0.46],
      [0.022, -0.15, 0.46],
      [0.022, -0.005, 0.46],
      [-0.022, -0.005, 0.46],
    ],
    [
      [-0.017, -0.06, 0.19],
      [0.017, -0.06, 0.19],
      [0.017, 0.0, 0.19],
      [-0.017, 0.0, 0.19],
    ],
    WALNUT,
    0x7a4526,
    WALNUT_DARK,
  )
  box(matte, [0, -0.0775, 0.465], [0.046, 0.15, 0.01], BUTT_PLATE)
  // Wrist into the receiver.
  hexa(
    matte,
    [
      [-0.017, -0.06, 0.19],
      [0.017, -0.06, 0.19],
      [0.017, 0.0, 0.19],
      [-0.017, 0.0, 0.19],
    ],
    [
      [-0.018, -0.045, 0.1],
      [0.018, -0.045, 0.1],
      [0.018, 0.02, 0.1],
      [-0.018, 0.02, 0.1],
    ],
    WALNUT,
    0x7a4526,
  )
  // Brass receiver, a side plate inset in a lighter brass, the hammer behind it.
  box(brass, [0, -0.005, 0.0], [0.04, 0.085, 0.2], BRASS, BRASS_LIGHT)
  box(brass, [0.021, -0.005, 0.01], [0.002, 0.05, 0.12], BRASS_LIGHT)
  box(brass, [-0.021, -0.005, 0.01], [0.002, 0.05, 0.12], BRASS_LIGHT)
  box(matte, [0, 0.022, 0.035], [0.012, 0.01, 0.06], STEEL) // the bolt's top
  hexa(
    matte,
    [
      [-0.006, 0.02, 0.105],
      [0.006, 0.02, 0.105],
      [0.006, 0.05, 0.12],
      [-0.006, 0.05, 0.12],
    ],
    [
      [-0.006, 0.02, 0.09],
      [0.006, 0.02, 0.09],
      [0.006, 0.048, 0.105],
      [-0.006, 0.048, 0.105],
    ],
    STEEL,
  )
  lever(brass)
  // Blued octagonal barrel and the magazine tube under it.
  tube(matte, 0, 0.028, 0.012, -0.1, MUZZLE[2], 8, BLUED, 0x1c1f22)
  tube(matte, 0, -0.004, 0.01, -0.1, -0.64, 8, STEEL)
  tube(brass, 0, -0.004, 0.011, -0.64, -0.655, 8, BRASS_DARK) // the tube's cap
  // Walnut fore-end round barrel and tube.
  hexa(
    matte,
    [
      [-0.019, -0.03, -0.1],
      [0.019, -0.03, -0.1],
      [0.019, 0.03, -0.1],
      [-0.019, 0.03, -0.1],
    ],
    [
      [-0.016, -0.024, -0.4],
      [0.016, -0.024, -0.4],
      [0.016, 0.026, -0.4],
      [-0.016, 0.026, -0.4],
    ],
    WALNUT,
    0x7a4526,
  )
  // Brass barrel bands, the sights.
  box(brass, [0, 0.0, -0.405], [0.036, 0.062, 0.012], BRASS, BRASS_LIGHT)
  box(brass, [0, 0.012, -0.6], [0.03, 0.05, 0.01], BRASS, BRASS_LIGHT)
  box(matte, [0, 0.046, -0.2], [0.014, 0.012, 0.008], STEEL) // rear sight
  box(brass, [0, 0.047, -0.72], [0.003, 0.014, 0.01], BRASS_LIGHT) // front bead
}

/** One GLB: a mesh of two primitives (matte, brass) and the named empties. */
export function buildRifle(): Buffer {
  matte = new Geo()
  brass = new Geo()
  rifle()
  const chunks: Buffer[] = [],
    views: object[] = [],
    accessors: object[] = []
  let offset = 0
  const push = (bytes: Buffer): number => {
    const pad = (4 - (bytes.length % 4)) % 4
    views.push({
      buffer: 0,
      byteOffset: offset,
      byteLength: bytes.length,
      target: 34962,
    })
    chunks.push(Buffer.concat([bytes, Buffer.alloc(pad)]))
    offset += bytes.length + pad
    return views.length - 1
  }
  const primitive = (g: Geo, material: number): object => {
    const count = g.pos.length / 3,
      min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < g.pos.length; i++) {
      min[i % 3] = Math.min(min[i % 3]!, g.pos[i]!)
      max[i % 3] = Math.max(max[i % 3]!, g.pos[i]!)
    }
    const acc = (
      view: number,
      type: string,
      componentType: number,
      extra: object = {},
    ): number => {
      accessors.push({ bufferView: view, componentType, count, type, ...extra })
      return accessors.length - 1
    }
    return {
      attributes: {
        POSITION: acc(
          push(Buffer.from(new Float32Array(g.pos).buffer)),
          'VEC3',
          5126,
          { min, max },
        ),
        NORMAL: acc(
          push(Buffer.from(new Float32Array(g.nor).buffer)),
          'VEC3',
          5126,
        ),
        COLOR_0: acc(
          push(Buffer.from(new Uint8Array(g.col).buffer)),
          'VEC4',
          5121,
          { normalized: true },
        ),
      },
      material,
    }
  }
  const meshes = [
    {
      name: 'lever-action',
      primitives: [primitive(matte, 0), primitive(brass, 1)],
    },
  ]
  const nodes = [
    { name: 'lever-action', mesh: 0 },
    { name: 'muzzle', translation: MUZZLE },
    { name: 'grip', translation: GRIP },
    { name: 'fore', translation: FORE },
  ]
  const bin = Buffer.concat(chunks)
  const json = {
    asset: {
      version: '2.0',
      generator: 'shardfile src/tools/brasscap/rifle.ts (BM-3)',
    },
    scene: 0,
    scenes: [{ name: 'brasscap-lever-action', nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes,
    materials: [
      {
        name: 'Matte',
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0,
          roughnessFactor: 0.85,
        },
      },
      {
        name: 'Brass',
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0.25,
          roughnessFactor: 0.45,
        },
      },
    ],
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
export function rifleTriangles(): number {
  return (matte.pos.length + brass.pos.length) / 9
}

if (process.argv[1] === import.meta.filename) {
  const out = process.argv[2] ?? 'corpus/sources/brasscap-mesa/rifle.glb',
    file = buildRifle()
  writeFileSync(out, file)
  process.stdout.write(
    `${out}: ${file.length} bytes, ${rifleTriangles()} triangles\n`,
  )
}
