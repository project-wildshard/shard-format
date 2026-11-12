/* oxlint-disable eslint/no-magic-numbers, eslint/id-length, unicorn/numeric-separators-style, unicorn/number-literal-case, typescript/no-non-null-assertion, eslint/capitalized-comments, eslint/no-inline-comments, eslint/no-bitwise, eslint/sort-vars, eslint/no-plusplus, eslint/curly, typescript/explicit-function-return-type, eslint/max-params, typescript/explicit-member-accessibility, eslint/max-statements, unicorn/no-zero-fractions, unicorn/consistent-function-scoping, unicorn/max-nested-calls, typescript/prefer-readonly-parameter-types, eslint/max-lines-per-function, typescript/no-confusing-void-expression, node/no-sync, eslint/no-shadow, eslint/max-lines, import/exports-last, import/group-exports -- Author-side level data, a stand-in for a Blender export: coordinates and colours, never shipped or imported. */
// Brasscap Mesa (Template 2) level blockout, BM-1 in meta TEMPLATE-E2E-PLAN.
// An author-side stand-in for the Blender export: it writes a flat-shaded,
// vertex-coloured low-poly canyon and its sunset sky dome as one GLB. It is
// never part of the template's runtime; the GLB it writes is the raw asset.
// The output is deterministic: a fixed-seed generator, so the same source
// writes the same bytes (canyon.test.ts holds the committed GLB to that).
//   node src/tools/brasscap/canyon.ts [out.glb]
import { writeFileSync } from 'node:fs'

type V3 = readonly [number, number, number]
type Hex = number

/** sRGB hex to linear 0..255 bytes, as glTF COLOR_0 is linear. */
function linear(hex: Hex): [number, number, number] {
  const c = (v: number): number => {
    const s = v / 255
    return Math.round(
      (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4) * 255,
    )
  }
  return [c((hex >> 16) & 255), c((hex >> 8) & 255), c(hex & 255)]
}

const SEED = 1337
let seed = SEED
function rand(): number {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 4294967296
}
const jitter = (n: number): number => (rand() * 2 - 1) * n

export class Geo {
  readonly pos: number[] = []
  readonly nor: number[] = []
  readonly col: number[] = []
  tri(a: V3, b: V3, c: V3, hex: Hex): void {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
      w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    const n = [
      u[1]! * w[2]! - u[2]! * w[1]!,
      u[2]! * w[0]! - u[0]! * w[2]!,
      u[0]! * w[1]! - u[1]! * w[0]!,
    ]
    const len = Math.hypot(n[0]!, n[1]!, n[2]!) || 1
    const rgb = linear(hex)
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2])
      this.nor.push(n[0]! / len, n[1]! / len, n[2]! / len)
      this.col.push(rgb[0], rgb[1], rgb[2], 255)
    }
  }
  quad(a: V3, b: V3, c: V3, d: V3, hex: Hex): void {
    this.tri(a, b, c, hex)
    this.tri(a, c, d, hex)
  }
  /** An extruded polygon (counter-clockwise seen from above) from y0 to y1, with a top cap. */
  prism(
    ring: readonly (readonly [number, number])[],
    y0: number,
    y1: number,
    side: Hex,
    top: Hex,
  ): void {
    const n = ring.length
    for (let i = 0; i < n; i++) {
      const p = ring[i]!,
        q = ring[(i + 1) % n]!
      this.quad(
        [p[0], y0, p[1]],
        [q[0], y0, q[1]],
        [q[0], y1, q[1]],
        [p[0], y1, p[1]],
        side,
      )
    }
    const cx = ring.reduce((s, p) => s + p[0], 0) / n,
      cz = ring.reduce((s, p) => s + p[1], 0) / n
    for (let i = 0; i < n; i++) {
      const p = ring[i]!,
        q = ring[(i + 1) % n]!
      this.tri([cx, y1, cz], [p[0], y1, p[1]], [q[0], y1, q[1]], top)
    }
  }
  box(c: V3, s: V3, hex: Hex, yaw = 0, top: Hex = hex): void {
    const [hx, hz] = [s[0] / 2, s[2] / 2],
      cos = Math.cos(yaw),
      sin = Math.sin(yaw)
    const ring = (
      [
        [-hx, hz],
        [hx, hz],
        [hx, -hz],
        [-hx, -hz],
      ] as const
    ).map(
      ([x, z]) => [c[0] + x * cos + z * sin, c[2] - x * sin + z * cos] as const,
    )
    this.prism(ring, c[1], c[1] + s[1], hex, top)
  }
  cylinder(
    c: V3,
    r: number,
    h: number,
    sides: number,
    hex: Hex,
    top: Hex = hex,
  ): void {
    this.prism(
      Array.from({ length: sides }, (_, i) => {
        const a = (-i / sides) * Math.PI * 2
        return [c[0] + Math.cos(a) * r, c[2] + Math.sin(a) * r] as const
      }),
      c[1],
      c[1] + h,
      hex,
      top,
    )
  }
}

let world = new Geo(),
  sky = new Geo(),
  glow = new Geo()
const BANDS: readonly Hex[] = [
  0xa94a35, 0xc4663f, 0xd98a52, 0xb9553a, 0xe2a466, 0x9c4130,
]
const SAND: readonly Hex[] = [0xdba06a, 0xd4955d, 0xe2ab74, 0xcf8f58]

/** A banded mesa: stacked jittered tiers, each one band colour, narrowing as it rises. */
function mesa(
  x: number,
  z: number,
  rx: number,
  rz: number,
  height: number,
  tiers: number,
): void {
  let y = 0
  for (let t = 0; t < tiers; t++) {
    const shrink = 1 - t * 0.07 - (t === tiers - 1 ? 0.06 : 0),
      sides = 8 + Math.floor(rand() * 3),
      h = (height / tiers) * (0.8 + rand() * 0.4)
    const ring = Array.from({ length: sides }, (_, i) => {
      const a = (-i / sides) * Math.PI * 2
      return [
        x + Math.cos(a) * rx * shrink * (0.85 + rand() * 0.25),
        z + Math.sin(a) * rz * shrink * (0.85 + rand() * 0.25),
      ] as const
    })
    world.prism(
      ring,
      y,
      y + h,
      BANDS[(t * 2 + Math.floor(rand() * 2)) % BANDS.length]!,
      0xc9794a,
    )
    y += h
  }
}

/** The canyon floor: a coarse faceted grid, flat on the walkway. */
function ground(): void {
  const step = 12,
    half = 216
  const h = (x: number, z: number): number =>
    Math.abs(x) < 26 && z > -110 && z < 30 ? 0 : 0.6 + Math.abs(jitter(0.8))
  const heights = new Map<string, number>()
  const at = (x: number, z: number): number => {
    const k = `${x},${z}`
    if (!heights.has(k)) heights.set(k, h(x, z))
    return heights.get(k)!
  }
  for (let x = -half; x < half; x += step) {
    for (let z = -half; z < half; z += step) {
      const a: V3 = [x, at(x, z), z],
        b: V3 = [x, at(x, z + step), z + step]
      const c: V3 = [x + step, at(x + step, z + step), z + step],
        d: V3 = [x + step, at(x + step, z), z]
      world.tri(a, b, c, SAND[Math.floor(rand() * SAND.length)]!)
      world.tri(a, c, d, SAND[Math.floor(rand() * SAND.length)]!)
    }
  }
  // The trail from the depot to the gate, a shade lighter, just above the floor.
  for (let z = 0; z > -64; z -= 4) {
    const x0 = Math.sin(z * 0.05) * 3,
      x1 = Math.sin((z - 4) * 0.05) * 3
    world.quad(
      [x0 - 1.6, 0.02, z],
      [x0 + 1.6, 0.02, z],
      [x1 + 1.6, 0.02, z - 4],
      [x1 - 1.6, 0.02, z - 4],
      0xe8b886,
    )
  }
}

/** The depot: a red plank shack with a tin roof and the porch the player spawns on. */
function depot(): void {
  world.box([-6, 0, 2], [6, 0.4, 10], 0x7a4a2b) // footing
  world.box([-6.5, 0.4, 2], [5, 3.6, 9], 0xa8402f, 0, 0x8a3326) // walls
  for (let z = -1.5; z <= 5.5; z += 3.5) {
    world.box([-3.97, 1.15, z], [0.08, 1.7, 1.7], 0x6b4026) // window frame
    glow.box([-3.9, 1.3, z], [0.04, 1.4, 1.4], 0xffa94d) // lit window
  }
  world.box([-1.5, 0, 2], [4, 0.35, 10], 0x8a5a36, 0, 0x9c6a40) // porch deck
  for (const z of [-3.3, 7.3])
    world.box([0.5, 0.35, z], [0.25, 3.3, 0.25], 0x6b4026) // porch posts
  // Tin roof, two sloped slabs.
  const roof = (
    y0: number,
    y1: number,
    x0: number,
    x1: number,
    hex: Hex,
  ): void =>
    world.quad(
      [x0, y0, 7.5],
      [x1, y1, 7.5],
      [x1, y1, -3.5],
      [x0, y0, -3.5],
      hex,
    )
  roof(4.1, 3.75, -9.4, 0.8, 0x8b98a1)
  // The underside, wound the other way, so the roof shows from the porch.
  world.quad(
    [-9.4, 3.65, -3.5],
    [0.8, 3.6, -3.5],
    [0.8, 3.6, 7.5],
    [-9.4, 3.65, 7.5],
    0x6f7a82,
  )
  world.box([-6.5, 4.0, 2], [5.4, 0.9, 9.4], 0x8a3326, 0, 0x8b98a1)
  // The rifle rack at the porch's front: two A-frame legs and a bar, the lever-action resting on it.
  for (const x of [-3.2, -1.2])
    world.box([x, 0.35, -0.8], [0.16, 1.25, 0.5], 0x8a5a36, 0, 0x9c6a40)
  world.box([-2.2, 0.75, -0.95], [2.2, 0.1, 0.35], 0x7a4a2b) // shelf
  world.box([-2.2, 1.5, -0.95], [2.2, 0.12, 0.12], 0x7a4a2b) // top bar
  world.box([-2.2, 0.9, -1.05], [2.0, 0.55, 0.06], 0x6b4026) // back board
  world.box([-2.75, 1.08, -0.92], [0.7, 0.16, 0.07], 0x5a3420, 0, 0x6b4026) // stock
  world.box([-2.3, 1.12, -0.92], [0.32, 0.14, 0.08], 0xc9a227, 0, 0xe0b830) // brass receiver
  world.box([-2.35, 1.0, -0.92], [0.14, 0.1, 0.06], 0xc9a227) // the lever loop
  world.box([-1.65, 1.17, -0.92], [1.0, 0.05, 0.05], 0x2f3338) // barrel
  world.box([-1.85, 1.1, -0.92], [0.6, 0.06, 0.07], 0x5a3420) // fore-end
  world.cylinder([-1.2, 0.35, 4.6], 0.45, 1.0, 8, 0x7a4a2b, 0x6b4026) // barrel by the rack
  world.cylinder([-1.2, 0.95, 3.1], 0.12, 0.6, 6, 0xc9a227) // the bell's stand-in
}

function cactus(x: number, z: number, h: number): void {
  world.cylinder([x, 0, z], 0.32, h, 6, 0x5f8a4a, 0x6f9a55)
  const arm = (dx: number, y: number, up: number): void => {
    world.box([x + dx / 2, y, z], [Math.abs(dx), 0.4, 0.4], 0x4c7a3c)
    world.cylinder([x + dx, y, z], 0.22, up, 6, 0x5f8a4a, 0x6f9a55)
  }
  arm(0.9, h * 0.45, h * 0.35)
  if (rand() > 0.4) arm(-0.8, h * 0.6, h * 0.25)
}

function boulder(x: number, z: number, r: number): void {
  const top: V3 = [x, r * 1.1, z],
    bottom: V3 = [x, 0, z]
  const ring: V3[] = Array.from({ length: 6 }, (_, i) => {
    const a = (-i / 6) * Math.PI * 2
    return [
      x + Math.cos(a) * r * (0.8 + rand() * 0.4),
      r * (0.3 + rand() * 0.3),
      z + Math.sin(a) * r * (0.8 + rand() * 0.4),
    ]
  })
  for (let i = 0; i < 6; i++) {
    world.tri(top, ring[i]!, ring[(i + 1) % 6]!, 0xa86a52)
    world.tri(bottom, ring[(i + 1) % 6]!, ring[i]!, 0x8a5440)
  }
}

/** A bandit camp: a canvas tent, crates, a fire ring and a flag on a tall pole. */
function camp(x: number, z: number): void {
  const w = 1.6,
    l = 2.6
  world.quad(
    [x - w, 0, z - l],
    [x - w, 0, z + l],
    [x, 2.2, z + l],
    [x, 2.2, z - l],
    0xe8d7b0,
  )
  world.quad(
    [x, 2.2, z - l],
    [x, 2.2, z + l],
    [x + w, 0, z + l],
    [x + w, 0, z - l],
    0xd2bf96,
  )
  world.tri([x - w, 0, z + l], [x + w, 0, z + l], [x, 2.2, z + l], 0xc7b28a)
  world.tri([x + w, 0, z - l], [x - w, 0, z - l], [x, 2.2, z - l], 0xc7b28a)
  world.box([x + 2.6, 0, z + 1], [1, 1, 1], 0x8a5a36, 0.3, 0x9c6a40)
  world.box([x + 2.4, 1, z + 1], [0.7, 0.7, 0.7], 0x7a4a2b, 0.7)
  world.cylinder([x - 2.8, 0, z + 2.5], 0.9, 0.2, 7, 0x6e6058)
  glow.cylinder([x - 2.8, 0.2, z + 2.5], 0.35, 0.5, 5, 0xff8a2a, 0xffc04a)
  world.cylinder([x + 1.8, 0, z - 2], 0.06, 7, 5, 0x5e3a22)
  world.quad(
    [x + 1.8, 6.2, z - 2],
    [x + 3.2, 6.45, z - 2],
    [x + 3.2, 6.95, z - 2],
    [x + 1.8, 6.9, z - 2],
    0xc93a2c,
  )
  world.quad(
    [x + 1.8, 6.9, z - 2],
    [x + 3.2, 6.95, z - 2],
    [x + 3.2, 6.45, z - 2],
    [x + 1.8, 6.2, z - 2],
    0xc93a2c,
  )
}

/** The canyon gate: stone pillars, a plank gate and a sign board. */
function gate(): void {
  world.box([-4.5, 0, -62], [2.4, 7, 2.4], 0x9a6a4a, 0, 0x8a5c40)
  world.box([8.5, 0, -62], [2.4, 7, 2.4], 0x9a6a4a, 0, 0x8a5c40)
  for (let x = -3; x < 7.2; x += 0.85)
    world.box(
      [x + 0.4, 0, -62],
      [0.75, 5.2, 0.3],
      x % 1.7 < 0.85 ? 0x7a4a2b : 0x6b4026,
    )
  world.box([2, 3.6, -61.7], [10.5, 0.35, 0.2], 0x5e3a22)
  world.box([2, 1.2, -61.7], [10.5, 0.35, 0.2], 0x5e3a22)
  world.box([2, 5.4, -61.9], [5, 1.3, 0.3], 0x5e3a22)
  world.box([2, 5.55, -61.7], [4.4, 0.9, 0.1], 0xc9a26a)
}

function waterTower(x: number, z: number): void {
  for (const [dx, dz] of [
    [-1.6, -1.6],
    [1.6, -1.6],
    [1.6, 1.6],
    [-1.6, 1.6],
  ] as const)
    world.box([x + dx, 0, z + dz], [0.3, 7, 0.3], 0x4f3322)
  world.box([x, 3, z], [3.6, 0.2, 3.6], 0x5e3a22)
  world.cylinder([x, 7, z], 2.4, 3.6, 10, 0x8a5a36, 0x7a4a2b)
  world.prism(
    Array.from({ length: 10 }, (_, i) => {
      const a = (-i / 10) * Math.PI * 2
      return [x + Math.cos(a) * 2.6, z + Math.sin(a) * 2.6] as const
    }),
    10.6,
    10.8,
    0x7d8890,
    0x8b98a1,
  )
  world.cylinder([x, 10.8, z], 1.2, 1.0, 10, 0x8b98a1, 0x9aa6ae)
}

/** A rail line curving off down the canyon, with a fence beside it. */
function railway(): void {
  const path = (t: number): [number, number] => [
    9 + t * 0.12 + Math.sin(t * 0.02) * 6,
    14 - t,
  ]
  for (let t = 0; t < 150; t += 1.6) {
    const [x, z] = path(t),
      [x2, z2] = path(t + 1)
    const yaw = Math.atan2(x2 - x, -(z2 - z))
    world.box([x, 0, z], [2.4, 0.12, 0.35], 0x6b4a34, -yaw) // across the track
  }
  for (const off of [-0.7, 0.7]) {
    for (let t = 0; t < 150; t += 4) {
      const [x, z] = path(t),
        [x2, z2] = path(t + 4)
      world.quad(
        [x + off - 0.06, 0.2, z],
        [x + off + 0.06, 0.2, z],
        [x2 + off + 0.06, 0.2, z2],
        [x2 + off - 0.06, 0.2, z2],
        0x8a8f94,
      )
    }
  }
  for (let t = 0; t < 70; t += 3) {
    const [x, z] = path(t),
      [, z2] = path(t + 3)
    world.box([x - 2.6, 0, z], [0.18, 1.2, 0.18], 0x6b4026)
    world.box([x - 2.6, 0.75, (z + z2) / 2], [0.08, 0.14, 3], 0x7a4a2b)
  }
}

/** A tin target plate on a post, the first thing the rifle is for. */
/** A flat disc upright in the XY plane at depth z, facing +z (towards the depot) and -z. */
function plate(x: number, y: number, z: number, r: number, hex: Hex): void {
  const sides = 12,
    at = (i: number): V3 => {
      const a = (i / sides) * Math.PI * 2
      return [x + Math.cos(a) * r, y + Math.sin(a) * r, z]
    }
  for (let i = 0; i < sides; i++) {
    world.tri([x, y, z], at(i), at(i + 1), hex)
    world.tri([x, y, z], at(i + 1), at(i), hex)
  }
}

function target(x: number, z: number): void {
  world.box([x, 0, z], [0.18, 1.3, 0.18], 0x6b4026)
  plate(x, 1.55, z + 0.12, 0.42, 0xe8e1d0)
  plate(x, 1.55, z + 0.14, 0.28, 0xb8322a)
  plate(x, 1.55, z + 0.16, 0.12, 0xe8e1d0)
}

function scene(): void {
  ground()
  depot()
  gate()
  waterTower(15, -20)
  railway()
  for (const [x, z] of [
    [-14, -28],
    [13, -40],
    [-3, -80],
  ] as const)
    camp(x, z)
  target(2.5, -10)
  target(-3.5, -14)
  // The canyon walls: left and right rows of banded mesas, and buttes beyond the gate.
  for (let z = 10; z > -110; z -= 22) {
    mesa(
      -34 + jitter(4),
      z + jitter(4),
      12 + rand() * 6,
      12 + rand() * 4,
      14 + rand() * 14,
      5 + Math.floor(rand() * 2),
    )
    mesa(
      38 + jitter(4),
      z - 8 + jitter(4),
      12 + rand() * 6,
      12 + rand() * 4,
      12 + rand() * 12,
      5,
    )
  }
  mesa(-14, -60, 9, 6, 9, 3)
  mesa(19, -64, 9, 6, 10, 3)
  for (let i = 0; i < 9; i++)
    mesa(
      -120 + i * 30 + jitter(8),
      -150 - rand() * 50,
      14 + rand() * 10,
      10 + rand() * 6,
      18 + rand() * 30,
      5,
    )
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2,
      r = 120 + rand() * 70
    mesa(
      Math.cos(a) * r,
      Math.sin(a) * r + 40,
      10 + rand() * 12,
      10 + rand() * 8,
      10 + rand() * 25,
      3,
    )
  }
  for (const [x, z, h] of [
    [5, -6, 3.2],
    [-6, -20, 3.8],
    [7, -34, 2.8],
    [-10, -48, 3.5],
    [4, -50, 2.4],
    [22, 0, 3.6],
    [-18, 10, 3],
  ] as const)
    cactus(x, z, h)
  for (let i = 0; i < 18; i++)
    boulder(jitter(22), -8 - rand() * 70, 0.3 + rand() * 0.6)
}

/** The sunset dome: turquoise zenith to a gold horizon, pink clouds and a low sun behind the gate. */
function skyDome(): void {
  const r = 900,
    rows = 12,
    cols = 28
  const colour = (el: number): Hex => {
    const stops: readonly (readonly [number, Hex])[] = [
      [-0.3, 0xe09058],
      [0, 0xffb455],
      [0.06, 0xffa95e],
      [0.14, 0xf9be82],
      [0.24, 0xc9d2a8],
      [0.36, 0x7cc8c6],
      [0.6, 0x45b6c4],
      [1.6, 0x2fa3bb],
    ]
    for (let i = 1; i < stops.length; i++) {
      const [e1, c1] = stops[i]!,
        [e0, c0] = stops[i - 1]!
      if (el <= e1) {
        const t = (el - e0) / (e1 - e0),
          m = (s: number): number =>
            Math.round(((c0 >> s) & 255) * (1 - t) + ((c1 >> s) & 255) * t)
        return (m(16) << 16) | (m(8) << 8) | m(0)
      }
    }
    return 0x34a9bd
  }
  const p = (row: number, col: number): V3 => {
    const el = -0.3 + (row / rows) * (Math.PI / 2 + 0.3),
      az = (col / cols) * Math.PI * 2
    return [
      Math.cos(el) * Math.cos(az) * r,
      Math.sin(el) * r,
      Math.cos(el) * Math.sin(az) * r,
    ]
  }
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const el = -0.3 + ((row + 0.5) / rows) * (Math.PI / 2 + 0.3)
      // Inward-facing, so the inside of the dome is the front. The top row
      // meets at the pole, so it is a fan of single triangles.
      if (row === rows - 1)
        sky.tri(p(row, col), p(rows, col), p(row, col + 1), colour(el))
      else
        sky.quad(
          p(row, col),
          p(row + 1, col),
          p(row + 1, col + 1),
          p(row, col + 1),
          colour(el),
        )
    }
  }
  const cloud = (
    az: number,
    el: number,
    w: number,
    h: number,
    hex: Hex,
  ): void => {
    const d = r * 0.95,
      at = (a: number, e: number): V3 => [
        Math.cos(e) * Math.sin(a) * d,
        Math.sin(e) * d,
        -Math.cos(e) * Math.cos(a) * d,
      ]
    const pts: V3[] = Array.from({ length: 7 }, (_, i) => {
      const t = (i / 7) * Math.PI * 2
      return at(
        az + Math.cos(t) * w * (0.8 + rand() * 0.3),
        el + Math.sin(t) * h * (0.7 + rand() * 0.5),
      )
    })
    const c = at(az, el)
    for (let i = 0; i < 7; i++) sky.tri(c, pts[i]!, pts[(i + 1) % 7]!, hex)
  }
  for (const [az, el, w, h] of [
    [-0.55, 0.42, 0.22, 0.03],
    [-0.15, 0.36, 0.2, 0.025],
    [0.25, 0.33, 0.26, 0.03],
    [0.6, 0.4, 0.18, 0.025],
    [-0.9, 0.3, 0.2, 0.02],
    [0.95, 0.28, 0.24, 0.025],
    [0.05, 0.55, 0.14, 0.02],
  ] as const) {
    cloud(az, el, w, h, 0xf79a7a)
    cloud(az + 0.02, el - 0.012, w * 0.8, h * 0.6, 0xe9806e)
  }
  cloud(0.03, 0.035, 0.035, 0.035, 0xfff2c0)
}

/** Builds the level GLB from scratch; every call returns the same bytes. */
export function buildCanyon(): Buffer {
  seed = SEED
  world = new Geo()
  sky = new Geo()
  glow = new Geo()
  scene()
  skyDome()
  const chunks: Buffer[] = [],
    views: object[] = [],
    accessors: object[] = []
  let offset = 0
  const push = (bytes: Buffer, target: number): number => {
    const pad = (4 - (bytes.length % 4)) % 4,
      padded = Buffer.concat([bytes, Buffer.alloc(pad)])
    views.push({
      buffer: 0,
      byteOffset: offset,
      byteLength: bytes.length,
      target,
    })
    chunks.push(padded)
    offset += padded.length
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
    const position = acc(
      push(Buffer.from(new Float32Array(g.pos).buffer), 34962),
      'VEC3',
      5126,
      { min, max },
    )
    const normal = acc(
      push(Buffer.from(new Float32Array(g.nor).buffer), 34962),
      'VEC3',
      5126,
    )
    const colour = acc(
      push(Buffer.from(new Uint8Array(g.col).buffer), 34962),
      'VEC4',
      5121,
      { normalized: true },
    )
    return {
      attributes: { POSITION: position, NORMAL: normal, COLOR_0: colour },
      material,
    }
  }
  const meshes = [
    { name: 'canyon', primitives: [primitive(world, 0)] },
    { name: 'sky', primitives: [primitive(sky, 1)] },
    { name: 'glow', primitives: [primitive(glow, 2)] },
  ]
  // Named empties the product rows point at (spawn, rack, targets, camps, gate, the Wyrm's pit).
  const marks: readonly (readonly [string, V3])[] = [
    ['spawn', [-1.6, 0.35, 2.6]],
    ['rack', [-2.2, 1.12, -0.92]],
    ['target.1', [2.5, 1.55, -9.88]],
    ['target.2', [-3.5, 1.55, -13.88]],
    ['camp.1', [-14, 0, -28]],
    ['camp.2', [13, 0, -40]],
    ['camp.3', [-3, 0, -80]],
    ['gate', [2, 0, -62]],
    ['wyrm', [2, 0, -100]],
  ]
  const nodes = [
    { name: 'canyon', mesh: 0 },
    { name: 'sky', mesh: 1 },
    { name: 'glow', mesh: 2 },
    ...marks.map(([name, translation]) => ({ name, translation })),
  ]
  const bin = Buffer.concat(chunks)
  const json = {
    asset: {
      version: '2.0',
      generator: 'shardfile src/tools/brasscap/canyon.ts (BM-1)',
    },
    extensionsUsed: ['KHR_materials_unlit'],
    scene: 0,
    scenes: [{ name: 'brasscap-mesa', nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes,
    materials: [
      {
        name: 'Mesa',
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0,
          roughnessFactor: 1,
        },
      },
      {
        name: 'Sky',
        doubleSided: true,
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0,
          roughnessFactor: 1,
        },
        extensions: { KHR_materials_unlit: {} },
      },
      {
        name: 'Glow',
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0,
          roughnessFactor: 1,
        },
        extensions: { KHR_materials_unlit: {} },
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

if (process.argv[1] === import.meta.filename) {
  const out = process.argv[2] ?? 'corpus/sources/brasscap-mesa/canyon.glb',
    file = buildCanyon()
  writeFileSync(out, file)
  process.stdout.write(
    `${out}: ${file.length} bytes, ${(world.pos.length + sky.pos.length + glow.pos.length) / 9} triangles\n`,
  )
}
