/* oxlint-disable eslint/no-magic-numbers, eslint/id-length, unicorn/numeric-separators-style, unicorn/number-literal-case, typescript/no-non-null-assertion, eslint/capitalized-comments, eslint/no-inline-comments, eslint/no-bitwise, eslint/sort-vars, eslint/no-plusplus, eslint/curly, typescript/explicit-function-return-type, eslint/max-params, typescript/explicit-member-accessibility, eslint/max-statements, unicorn/no-zero-fractions, unicorn/consistent-function-scoping, unicorn/max-nested-calls, typescript/prefer-readonly-parameter-types, eslint/max-lines-per-function, node/no-sync, eslint/no-shadow, eslint/max-lines, import/exports-last, import/group-exports, eslint/no-use-before-define, eslint/no-continue -- Author-side level data, a stand-in for a Blender export: coordinates and colours, never shipped or imported. */
// Brasscap Mesa (Template 2) level blockout, BM-1 in meta TEMPLATE-E2E-PLAN.
// An author-side stand-in for the Blender export: it writes a flat-shaded,
// vertex-coloured low-poly canyon and its sunset sky dome as one GLB. It is
// never part of the template's runtime; the GLB it writes is the raw asset.
// The output is deterministic: a fixed-seed generator, so the same source
// writes the same bytes (canyon.test.ts holds the committed GLB to that).
//   node src/tools/brasscap/canyon.ts [out.glb]          the level, with its sky, and depot.glb beside it
//   node src/tools/brasscap/canyon.ts --bake <out.glb>   the bake input (BM-4)
import { writeFileSync } from 'node:fs'
import path from 'node:path'

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

/** LF2-7: while set, every triangle drawn is flagged `metal`; see `metal`. */
let metalOn = false

export class Geo {
  readonly pos: number[] = []
  readonly nor: number[] = []
  readonly col: number[] = []
  /** LF2-7: one flag a triangle, 1 for the `metal` material, 0 for `mesa`. */
  readonly mat: number[] = []
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
    this.mat.push(metalOn ? 1 : 0)
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

/** The three bandit camps (BM-4), as data: the tents and the `camp.N` empties both read this, so a
 *  layout pass moves them in one place. LF2-2: camp 2 stands on the 6 m ledge (`LEDGE`), camp 3 in the
 *  side canyon that opens on the gate (`SIDE`), still before the gate, since clearing it opens the gate. */
export const CAMPS: readonly (readonly [string, V3])[] = [
  ['camp.1', [-14, 0, -28]],
  ['camp.2', [13.5, 6, -34]],
  ['camp.3', [18.4, 0, -50.5]],
]

/** Camp 2's stepped mesa (LF2-2): two tiers to a flat top at `top` m, the west face to the trail, and a
 *  walkable stair of `steps` rock steps (`rise` m each, under the 0.3 m player step) along its south flank. */
export const LEDGE = {
  x0: 5,
  x1: 18.5,
  z0: -27,
  z1: -41,
  top: 6,
  step: 3.2,
  setback: 0.8,
  stairX: 4,
  stairZ: [-24.6, -27] as const,
  steps: 24,
  rise: 0.25,
  run: 0.55,
} as const

/** Camp 3's side canyon (LF2-2): a slot whose axis runs from the gate along `u`, walls `half` m either side,
 *  from `from` to `to` m out, closed at the far end, so the camp looks straight back at the gate. */
export const SIDE = {
  gate: [2, -62] as const,
  u: [0.8, 0.6] as const,
  half: 6.2,
  from: 9.5,
  to: 25,
} as const

/** The Dust Wyrm's sand pit past the gate (LF2-2): a sand floor `floor` m round the `wyrm` empty (BM-5's
 *  14 m arena and sand ring stay as they are), ringed by tall rocks `ring` m out. The one gap, the mouth,
 *  faces the gate: open `mouth` degrees either side of it; each rock spans about 21 degrees of the ring. */
export const PIT = {
  at: [2, -100] as const,
  floor: 10.5,
  ring: 14.5,
  mouth: 14,
} as const

let world = new Geo(),
  sky = new Geo(),
  glow = new Geo(),
  door = new Geo(),
  hero = new Geo(),
  heroGlow = new Geo(),
  /** The lever-action on its rack, a node of its own (`rack.rifle`): the bake makes it a drawn-only panel that the
   *  player's `brasscap.rack.taken` field hides once that player takes the rifle (TE-ENG6). */
  rackRifle = new Geo(),
  /** LF2-4: the near mesas and crags as BM-1's plain prisms. They feed the far stand-in and the source canyon.glb; the
   *  bake draws `rock` in their place. */
  shell = new Geo(),
  /** LF2-4: the same mesas and crags faceted, chamfered, capped and jittered, with scree at the foot: west of the
   *  trail (x < 0) and east of it, two source GLBs so each stays under the repo's 1 MiB limit. */
  rockWest = new Geo(),
  rockEast = new Geo(),
  /** LF2-4: the ground's dressing (ground.glb): patches, the path's edges, ruts, rocks and tufts; L0 tiles only. */
  dress = new Geo(),
  /** LF2-6: the camps', the gate's, the cacti's and the water tower's detail (props.glb), drawn in the L0 tiles
   *  only, and its lit parts (lantern glass, tent glow, flames). Their plain stand-ins go into `shell`. */
  props = new Geo(),
  propsGlow = new Geo(),
  /** LF2-6: the plain camps' flames; the source canyon.glb's glow keeps them, the bake draws the detail's. */
  plainGlow = new Geo()
/** The mesa bands. LF2-7 retuned them toward the targets' measured means: redder, a touch less green and blue
 *  (linear red x1.2, green and blue x0.95, half the measured step, as the LUT fits on top). */
const BANDS: readonly Hex[] = [
  0xb74834, 0xd5643d, 0xeb8750, 0xc95338, 0xf5a064, 0xa93f2f,
]
/** The canyon floor's sand. LF2-7: warmer and more saturated, toward the targets' orange (linear red x1.25, blue
 *  x0.8; LF2-4 found it paler than the targets'). */
const SAND: readonly Hex[] = [0xf2a05f, 0xea9553, 0xf9ab68, 0xe58f4f]

/** A banded mesa: stacked jittered tiers, each one band colour, narrowing as it rises. A `near` mesa (the canyon's
 *  walls and the buttes by the gate) goes to `shell` as plain prisms and to `rock` as a faceted cliff (LF2-4); the
 *  background stays plain in `world`. Either way it draws `rand` the same, so nothing after it moves. */
function mesa(
  centreX: number,
  centreZ: number,
  rx: number,
  rz: number,
  height: number,
  tiers: number,
  near = false,
): void {
  const [x, z] = clearOfLanes(centreX, centreZ, Math.max(rx, rz) * 1.1)
  const stack: Tier[] = []
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
    const band = BANDS[(t * 2 + Math.floor(rand() * 2)) % BANDS.length]!
    ;(near ? shell : world).prism(ring, y, y + h, band, 0xc9794a)
    stack.push({ ring, y0: y, y1: y + h, band })
    y += h
  }
  if (near) cliff(stack)
}

/** The four edge entry corridors (ENG-3b): engine's cook walks every 8 m entry lane flat at road height for 50 m
 *  inward (`walkEdgeEntries`, to 199.6 m from centre), so the floor is 0 within 12 m of each midline from 192 m out,
 *  one ground cell past the lane, and no mesa stands within 6 m of the midline from 195 m out. */
const LANE_FLOOR = 12,
  LANE_FLOOR_FROM = 192,
  LANE_CLEAR = 6,
  LANE_CLEAR_FROM = 195
const inLane = (x: number, z: number): boolean =>
  (Math.abs(x) <= LANE_FLOOR && Math.abs(z) >= LANE_FLOOR_FROM) ||
  (Math.abs(z) <= LANE_FLOOR && Math.abs(x) >= LANE_FLOOR_FROM)
/** A mesa's centre, moved sideways out of any entry corridor its footprint (`reach`) would cross; draws no `rand`. */
function clearOfLanes(x: number, z: number, reach: number): [number, number] {
  const out = (v: number): number => Math.sign(v || 1) * (LANE_CLEAR + reach)
  const across =
    Math.abs(z) + reach > LANE_CLEAR_FROM && Math.abs(x) - reach < LANE_CLEAR
  const along =
    Math.abs(x) + reach > LANE_CLEAR_FROM && Math.abs(z) - reach < LANE_CLEAR
  return [across ? out(x) : x, along ? out(z) : z]
}

/** The canyon floor: a coarse faceted grid, flat on the walkway and in the edge entry corridors. */
function ground(): void {
  const step = 12,
    half = 216
  const h = (x: number, z: number): number => {
    // The jitter is drawn either way, so the corridors move no other vertex.
    const y =
      Math.abs(x) < 26 && z > -110 && z < 30 ? 0 : 0.6 + Math.abs(jitter(0.8))
    return inLane(x, z) ? 0 : y
  }
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

function cactus(x: number, z: number, h: number): void {
  // LF2-6: the plain cactus is the far and L1 stand-in (`shell`); `saguaro` is its L0 detail, with the same arms.
  shell.cylinder([x, 0, z], 0.32, h, 6, 0x5f8a4a, 0x6f9a55)
  const arms: (readonly [number, number, number])[] = []
  const arm = (dx: number, y: number, up: number): void => {
    shell.box([x + dx / 2, y, z], [Math.abs(dx), 0.4, 0.4], 0x4c7a3c)
    shell.cylinder([x + dx, y, z], 0.22, up, 6, 0x5f8a4a, 0x6f9a55)
    arms.push([dx, y, up])
  }
  arm(0.9, h * 0.45, h * 0.35)
  if (rand() > 0.4) arm(-0.8, h * 0.6, h * 0.25)
  saguaro(x, z, h, arms)
}

/** The trail's centre line at z (the path quads in `ground` run between its 4 m points). */
const trailX = (z: number): number => Math.sin(z * 0.05) * 3

function boulder(x: number, z: number, r: number): void {
  // LF2-4: none on the trail or in front of a target post (it still draws `rand`, into a throwaway).
  const g =
    Math.abs(x - trailX(z)) < 2.6 + r ||
    Math.hypot(x - 2.5, z + 10) < 2.5 + r ||
    Math.hypot(x + 3.5, z + 14) < 2.5 + r
      ? new Geo()
      : world
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
    g.tri(top, ring[i]!, ring[(i + 1) % 6]!, 0xa25d40)
    g.tri(bottom, ring[(i + 1) % 6]!, ring[i]!, 0x7e4532)
  }
}

/** A bandit camp: a canvas tent, crates, a fire ring and a flag on a tall pole. LF2-6: this plain camp is the far
 *  and L1 stand-in (`shell`, its flame `plainGlow`); `campDetail` is what the L0 tiles draw. */
function camp(x: number, y: number, z: number): void {
  const w = 1.6,
    l = 2.6
  shell.quad(
    [x - w, y, z - l],
    [x - w, y, z + l],
    [x, y + 2.2, z + l],
    [x, y + 2.2, z - l],
    0xe8d7b0,
  )
  shell.quad(
    [x, y + 2.2, z - l],
    [x, y + 2.2, z + l],
    [x + w, y, z + l],
    [x + w, y, z - l],
    0xd2bf96,
  )
  shell.tri([x - w, y, z + l], [x + w, y, z + l], [x, y + 2.2, z + l], 0xc7b28a)
  shell.tri([x + w, y, z - l], [x - w, y, z - l], [x, y + 2.2, z - l], 0xc7b28a)
  shell.box([x + 2.6, y, z + 1], [1, 1, 1], 0x8a5a36, 0.3, 0x9c6a40)
  shell.box([x + 2.4, y + 1, z + 1], [0.7, 0.7, 0.7], 0x7a4a2b, 0.7)
  shell.cylinder([x - 2.8, y, z + 2.5], 0.9, 0.2, 7, 0x6e6058)
  plainGlow.cylinder(
    [x - 2.8, y + 0.2, z + 2.5],
    0.35,
    0.5,
    5,
    0xff8a2a,
    0xffc04a,
  )
  shell.cylinder([x + 1.8, y, z - 2], 0.06, 7, 5, 0x5e3a22)
  shell.quad(
    [x + 1.8, y + 6.2, z - 2],
    [x + 3.2, y + 6.45, z - 2],
    [x + 3.2, y + 6.95, z - 2],
    [x + 1.8, y + 6.9, z - 2],
    0xc93a2c,
  )
  shell.quad(
    [x + 1.8, y + 6.9, z - 2],
    [x + 3.2, y + 6.95, z - 2],
    [x + 3.2, y + 6.45, z - 2],
    [x + 1.8, y + 6.2, z - 2],
    0xc93a2c,
  )
}

/** The canyon gate: stone pillars and a sign board, and the plank gate itself as its own
 *  node (`gate.door`), so the bake makes it a panel with its own collider that a flag drops (BM-4). */
function gate(): void {
  world.box([-4.5, 0, -62], [2.4, 7, 2.4], 0x9a6a4a, 0, 0x8a5c40)
  world.box([8.5, 0, -62], [2.4, 7, 2.4], 0x9a6a4a, 0, 0x8a5c40)
  gateDoors()
  // LF2-6: the plain sign board is the far and L1 stand-in; `gateDetail` puts up the frame, the GATE sign, the
  // lantern and the bell post in the L0 tiles.
  shell.box([2, 5.4, -61.9], [5, 1.3, 0.3], 0x5e3a22)
  shell.box([2, 5.55, -61.7], [4.4, 0.9, 0.1], 0xc9a26a)
  gateDetail()
}

/** The water tower's plain stand-in (`shell`, LF2-6); `towerDetail` is what the L0 tiles draw. */
function waterTower(x: number, z: number): void {
  towerDetail(x, z)
  for (const [dx, dz] of [
    [-1.6, -1.6],
    [1.6, -1.6],
    [1.6, 1.6],
    [-1.6, 1.6],
  ] as const)
    shell.box([x + dx, 0, z + dz], [0.3, 7, 0.3], 0x4f3322)
  shell.box([x, 3, z], [3.6, 0.2, 3.6], 0x5e3a22)
  shell.cylinder([x, 7, z], 2.4, 3.6, 10, 0x8a5a36, 0x7a4a2b)
  metal(() => {
    shell.prism(
      Array.from({ length: 10 }, (_, i) => {
        const a = (-i / 10) * Math.PI * 2
        return [x + Math.cos(a) * 2.6, z + Math.sin(a) * 2.6] as const
      }),
      10.6,
      10.8,
      0x7d8890,
      0x8b98a1,
    )
    shell.cylinder([x, 10.8, z], 1.2, 1.0, 10, 0x8b98a1, 0x9aa6ae)
  })
}

/** The rail line's centre at distance t along it (the railway and the handcar on its siding share it). */
const railPath = (t: number): [number, number] => [
  9 + t * 0.12 + Math.sin(t * 0.02) * 6,
  14 - t,
]

/** A rail line curving off down the canyon into the gate's right butte, with a fence beside it. */
function railway(): void {
  const path = railPath
  for (let t = 0; t < 78; t += 1.6) {
    const [x, z] = path(t),
      [x2, z2] = path(t + 1)
    const yaw = Math.atan2(x2 - x, -(z2 - z))
    world.box([x, 0, z], [2.4, 0.12, 0.35], 0x6b4a34, -yaw) // across the track
  }
  // LF2-7: the rails are metal.
  metal(() => {
    for (const off of [-0.7, 0.7]) {
      for (let t = 0; t < 78; t += 4) {
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
  })
  // The fence stops short of camp 2's ledge (LF2-2), which stands where it ran on.
  for (let t = 0; t < 40; t += 3) {
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

/** A second fixed-seed generator for the LF2-2 layout, so adding it leaves BM-1's mesas, cacti and
 *  boulders exactly where they were (they draw from `rand`). */
function lcg(start: number): () => number {
  let state = start
  return (): number => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

/** A ring (x, z) wound the way `prism` wants it (clockwise in x, z, so the top cap faces up). */
function wound(
  ring: readonly (readonly [number, number])[],
): (readonly [number, number])[] {
  let area = 0
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!,
      q = ring[(i + 1) % ring.length]!
    area += p[0] * q[1] - q[0] * p[1]
  }
  return area > 0 ? ring.toReversed() : [...ring]
}

/** A quad turned to face away from `centre`, so a solid's faces all face out. */
function outQuad(
  g: Geo,
  a: V3,
  b: V3,
  c: V3,
  d: V3,
  centre: V3,
  hex: Hex,
): void {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
    w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  const n = [
    u[1]! * w[2]! - u[2]! * w[1]!,
    u[2]! * w[0]! - u[0]! * w[2]!,
    u[0]! * w[1]! - u[1]! * w[0]!,
  ]
  const out = [0, 1, 2].map(k => (a[k]! + c[k]!) / 2 - centre[k]!)
  if (n[0]! * out[0]! + n[1]! * out[1]! + n[2]! * out[2]! >= 0)
    g.quad(a, b, c, d, hex)
  else g.quad(a, d, c, b, hex)
}

/** A square beam from `a` to `b`, `w` m thick: a ladder rail, a rung, a barricade rail. */
function beam(g: Geo, a: V3, b: V3, w: number, hex: Hex): void {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const len = Math.hypot(d[0]!, d[1]!, d[2]!)
  const f = d.map(v => v / len)
  // One side across the beam, level where it can be; the other completes the frame.
  let s = [f[2]!, 0, -f[0]!]
  if (Math.hypot(s[0]!, s[2]!) < 1e-6) s = [1, 0, 0]
  const sl = Math.hypot(s[0]!, s[1]!, s[2]!)
  s = s.map(v => (v / sl) * (w / 2))
  const t = [
    f[1]! * s[2]! - f[2]! * s[1]!,
    f[2]! * s[0]! - f[0]! * s[2]!,
    f[0]! * s[1]! - f[1]! * s[0]!,
  ]
  const corner = (p: V3, i: number, j: number): V3 => [
    p[0] + s[0]! * i + t[0]! * j,
    p[1] + s[1]! * i + t[1]! * j,
    p[2] + s[2]! * i + t[2]! * j,
  ]
  const centre: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
  const ring = [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ] as const
  for (let k = 0; k < 4; k++) {
    const [i0, j0] = ring[k]!,
      [i1, j1] = ring[(k + 1) % 4]!
    outQuad(
      g,
      corner(a, i0, j0),
      corner(a, i1, j1),
      corner(b, i1, j1),
      corner(b, i0, j0),
      centre,
      hex,
    )
  }
  for (const p of [a, b])
    outQuad(
      g,
      corner(p, 1, 1),
      corner(p, -1, 1),
      corner(p, -1, -1),
      corner(p, 1, -1),
      centre,
      hex,
    )
}

/** The depot's shell (LF2-5): footing, red plank walls under a gable roof, the porch deck, posts and a shed
 *  roof over the porch. Only the shell is in the world mesh, so the far stand-in (welded from it) keeps
 *  the depot's bulk; every detail is `depotDetail`'s, in the depot's own GLB. */
const DEPOT = {
  /** The walls' x and z extent, and their top. */
  x0: -9,
  x1: -4,
  z0: -2.5,
  z1: 6.5,
  wallTop: 4.15,
  /** The gable roof: its ridge over the walls' middle, the fall per metre out, the eaves. */
  ridgeX: -6.5,
  ridgeY: 5.7,
  pitch: 0.62,
  eaveW: -9.4,
  eaveE: -3.95,
  roofZ: [-2.95, 6.95] as const,
  /** The porch's shed roof: from the wall (x, y) down to the front edge (x, y), along `porchZ`. */
  porchIn: [-3.95, 3.98] as const,
  porchOut: [0.95, 3.52] as const,
  porchZ: [-3.6, 7.6] as const,
  /** The porch posts' x and z, and the header beam's underside. */
  postX: 0.55,
  posts: [-3.3, 2.1, 7.3] as const,
  header: 3.15,
} as const

/** The facade's lit windows: centre z and width (the first narrower, so the bell's bracket clears it). */
const WINDOWS: readonly (readonly [number, number])[] = [
  [-1.9, 0.9],
  [2, 1.4],
  [5.5, 1.4],
]

/** The gable roof's height at x. */
const gableY = (x: number): number =>
  DEPOT.ridgeY - DEPOT.pitch * Math.abs(x - DEPOT.ridgeX)
/** The porch roof's top at x (its underside is 0.07 m lower). */
const porchY = (x: number): number => {
  const [x0, y0] = DEPOT.porchIn,
    [x1, y1] = DEPOT.porchOut
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
}

/** The depot: a red plank shack with a tin roof and the porch the player spawns on (the shell). */
function depot(): void {
  const D = DEPOT,
    cz = (D.z0 + D.z1) / 2,
    g = world
  world.box([-6, 0, 2], [6, 0.4, 10], 0x7a4a2b) // footing
  world.box(
    [(D.x0 + D.x1) / 2, 0.4, cz],
    [D.x1 - D.x0, D.wallTop - 0.4, D.z1 - D.z0],
    0xa8402f,
    0,
    0x8a3326,
  ) // walls
  for (const [z, w] of WINDOWS) {
    world.box([-3.97, 1.15, z], [0.08, 1.7, w + 0.3], 0x6b4026) // window frame
    glow.box([-3.9, 1.3, z], [0.04, 1.4, w], 0xffa94d) // lit window
  }
  world.box([-1.5, 0, 2], [4, 0.35, 10], 0x8a5a36, 0, 0x9c6a40) // porch deck
  for (const z of D.posts)
    world.box([D.postX, 0.35, z], [0.22, D.header - 0.35, 0.22], 0x6b4026) // porch posts
  // The gable roof: two slopes, each with an underside so the eaves show from below; the gables fill the ends.
  const [z0, z1] = D.roofZ,
    under: V3 = [D.ridgeX, 0, cz],
    over: V3 = [D.ridgeX, 20, cz]
  for (const eave of [D.eaveW, D.eaveE]) {
    const ridge: V3 = [D.ridgeX, D.ridgeY, z0],
      ridge1: V3 = [D.ridgeX, D.ridgeY, z1],
      e0: V3 = [eave, gableY(eave), z0],
      e1: V3 = [eave, gableY(eave), z1]
    metal(() => {
      outQuad(g, ridge, e0, e1, ridge1, under, 0x7c8296)
    })
    const drop = (p: V3): V3 => [p[0], p[1] - 0.06, p[2]]
    outQuad(
      world,
      drop(ridge),
      drop(e0),
      drop(e1),
      drop(ridge1),
      over,
      0x6b4026,
    )
  }
  for (const [z, out] of [
    [D.z0, -1],
    [D.z1, 1],
  ] as const) {
    const a: V3 = [D.x0, D.wallTop, z],
      b: V3 = [D.x1, D.wallTop, z],
      c: V3 = [D.ridgeX, D.ridgeY - 0.06, z] // up to the roof's underside, so no slit shows
    if (out < 0) world.tri(a, c, b, 0xa8402f)
    else world.tri(a, b, c, 0xa8402f)
  }
  // The porch's shed roof: tin on top, a plank ceiling underneath (lit, not a void), a fascia at the front.
  const [px0, px1] = [D.porchIn[0], D.porchOut[0]],
    [pz0, pz1] = D.porchZ,
    top = (x: number, z: number): V3 => [x, porchY(x), z],
    low = (x: number, z: number): V3 => [x, porchY(x) - 0.07, z]
  metal(() => {
    outQuad(
      world,
      top(px0, pz0),
      top(px1, pz0),
      top(px1, pz1),
      top(px0, pz1),
      [0, 0, 2],
      0x7c8296,
    )
  })
  outQuad(
    world,
    low(px0, pz0),
    low(px1, pz0),
    low(px1, pz1),
    low(px0, pz1),
    [0, 20, 2],
    0x9a6a44,
  )
  beam(
    world,
    [px1, porchY(px1) - 0.08, pz0],
    [px1, porchY(px1) - 0.08, pz1],
    0.16,
    0x6b4026,
  ) // fascia
  beam(
    world,
    [D.postX, D.header + 0.09, pz0],
    [D.postX, D.header + 0.09, pz1],
    0.18,
    0x6b4026,
  ) // header beam on the posts
}

/** A solid of revolution round the vertical axis at (x, z): rings (radius, y) from bottom to top, each band
 *  one colour, with a cap on each end (no ring may have radius 0, so no triangle is degenerate). */
function lathe(
  g: Geo,
  x: number,
  z: number,
  rings: readonly (readonly [number, number])[],
  sides: number,
  hex: Hex | readonly Hex[],
  caps = true,
): void {
  const at = (r: number, y: number, i: number): V3 => {
    const a = (-i / sides) * Math.PI * 2
    return [x + Math.cos(a) * r, y, z + Math.sin(a) * r]
  }
  for (let k = 0; k + 1 < rings.length; k++) {
    const [r0, y0] = rings[k]!,
      [r1, y1] = rings[k + 1]!,
      band = typeof hex === 'number' ? hex : hex[k % hex.length]!
    for (let i = 0; i < sides; i++)
      outQuad(
        g,
        at(r0, y0, i),
        at(r0, y0, i + 1),
        at(r1, y1, i + 1),
        at(r1, y1, i),
        [x, (y0 + y1) / 2, z],
        band,
      )
  }
  if (!caps) return
  const first = rings[0]!,
    last = rings.at(-1)!,
    end = typeof hex === 'number' ? hex : hex.at(-1)!
  for (let i = 0; i < sides; i++) {
    g.tri(
      [x, last[1], z],
      at(last[0], last[1], i),
      at(last[0], last[1], i + 1),
      end,
    )
    g.tri(
      [x, first[1], z],
      at(first[0], first[1], i + 1),
      at(first[0], first[1], i),
      end,
    )
  }
}

/** A wheel on an axle along x: a `sides`-gon of radius r, w m wide, centred at c. */
function wheel(
  g: Geo,
  c: V3,
  r: number,
  w: number,
  sides: number,
  hex: Hex,
): void {
  const at = (s: number, i: number): V3 => {
    const a = (i / sides) * Math.PI * 2
    return [c[0] + s * (w / 2), c[1] + Math.cos(a) * r, c[2] + Math.sin(a) * r]
  }
  for (let i = 0; i < sides; i++) {
    outQuad(g, at(-1, i), at(1, i), at(1, i + 1), at(-1, i + 1), c, hex)
    for (const s of [-1, 1]) {
      const hub: V3 = [c[0] + s * (w / 2), c[1], c[2]]
      // The cap faces out along x: wind it so its normal points the way s does.
      if (s > 0) g.tri(hub, at(s, i), at(s, i + 1), hex)
      else g.tri(hub, at(s, i + 1), at(s, i), hex)
    }
  }
}

/** Blocky capitals for the BRASSCAP sign, as strokes on a 3 by 5 grid (x right, y up). */
const LETTERS: Readonly<
  Record<string, readonly (readonly [number, number, number, number])[]>
> = {
  B: [
    [0, 0, 0, 5],
    [0, 5, 2.2, 5],
    [0, 2.5, 2.4, 2.5],
    [0, 0, 2.4, 0],
    [2.6, 2.9, 2.6, 4.6],
    [2.9, 0.4, 2.9, 2.1],
  ],
  R: [
    [0, 0, 0, 5],
    [0, 5, 2.2, 5],
    [2.6, 2.9, 2.6, 4.6],
    [0, 2.5, 2.2, 2.5],
    [1.3, 2.5, 2.9, 0],
  ],
  A: [
    [0, 0, 1.5, 5],
    [1.5, 5, 3, 0],
    [0.75, 1.8, 2.25, 1.8],
  ],
  S: [
    [0.4, 5, 3, 5],
    [0, 2.9, 0, 4.6],
    [0.4, 2.5, 2.6, 2.5],
    [3, 0.4, 3, 2.1],
    [0, 0, 2.6, 0],
  ],
  C: [
    [0.4, 5, 3, 5],
    [0, 0.4, 0, 4.6],
    [0.4, 0, 3, 0],
  ],
  P: [
    [0, 0, 0, 5],
    [0, 5, 2.2, 5],
    [2.6, 2.9, 2.6, 4.6],
    [0, 2.5, 2.2, 2.5],
  ],
  G: [
    [0.4, 5, 3, 5],
    [0, 0.4, 0, 4.6],
    [0.4, 0, 2.6, 0],
    [3, 0.4, 3, 2.3],
    [1.7, 2.3, 3, 2.3],
  ],
  T: [
    [0, 5, 3, 5],
    [1.5, 0, 1.5, 5],
  ],
  E: [
    [0, 0, 0, 5],
    [0, 5, 3, 5],
    [0, 2.5, 2.3, 2.5],
    [0, 0, 3, 0],
  ],
}

/** Two tin shades, alternating rib to rib. */
const TIN = [0x8d93a6, 0x868ca0] as const

/** Corrugated tin on both roofs and the ridge cap. */
function depotTin(): void {
  const D = DEPOT,
    g = hero
  // Corrugated tin: a raised rib down each slope every 0.32 m, two faces turned either way, so the sun
  // picks out light and dark lines; a few ribs run rusty.
  const rib = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    z: number,
    k: number,
  ): void => {
    const h = 0.035,
      w = 0.09,
      rusty = k % 11 === 3 || k % 13 === 7,
      hex = rusty ? 0x9a7a6a : TIN[k % 2]!
    const below: V3 = [(x0 + x1) / 2, -50, z]
    outQuad(
      g,
      [x0, y0, z - w],
      [x1, y1, z - w],
      [x1, y1 + h, z],
      [x0, y0 + h, z],
      below,
      hex,
    )
    outQuad(
      g,
      [x0, y0 + h, z],
      [x1, y1 + h, z],
      [x1, y1, z + w],
      [x0, y0, z + w],
      below,
      hex,
    )
  }
  const [rz0, rz1] = D.roofZ
  let k = 0
  for (let z = rz0 + 0.16; z < rz1; z += 0.32, k++) {
    // West slope runs ridge to eave toward -x; east toward +x: wind each rib so its faces point up.
    rib(D.eaveW, gableY(D.eaveW), D.ridgeX, D.ridgeY, z, k)
    rib(D.ridgeX, D.ridgeY, D.eaveE, gableY(D.eaveE), z, k + 5)
  }
  beam(
    g,
    [D.ridgeX, D.ridgeY + 0.02, rz0 - 0.05],
    [D.ridgeX, D.ridgeY + 0.02, rz1 + 0.05],
    0.16,
    0x6f7486,
  ) // ridge cap
  const [pz0, pz1] = D.porchZ,
    [px0, px1] = [D.porchIn[0], D.porchOut[0]]
  k = 0
  for (let z = pz0 + 0.16; z < pz1; z += 0.32, k++)
    rib(px0, porchY(px0), px1, porchY(px1), z, k + 2)
}

/** The porch's wood: the ceiling planks and rafters, braces, the deck, wall seams, windows, the door and the bench. */
function depotWood(): void {
  const D = DEPOT,
    g = hero,
    [pz0, pz1] = D.porchZ,
    [px0, px1] = [D.porchIn[0], D.porchOut[0]]
  let k = 0
  // The porch ceiling: planks along x, alternating shades, just under the roof, and rafters under them.
  const shades = [0xa4724a, 0x93633e, 0xab7a50] as const
  for (let z = pz0; z < pz1 - 0.01; z += 0.28, k++) {
    const z1 = Math.min(z + 0.27, pz1),
      y = (x: number): number => porchY(x) - 0.082
    outQuad(
      g,
      [px0, y(px0), z1],
      [px1, y(px1), z1],
      [px1, y(px1), z],
      [px0, y(px0), z],
      [0, 50, z],
      shades[k % 3]!,
    )
  }
  for (let z = pz0 + 0.2; z < pz1; z += 1.0)
    beam(
      g,
      [px0 + 0.02, porchY(px0) - 0.16, z],
      [px1 - 0.03, porchY(px1) - 0.16, z],
      0.13,
      0x6e4528,
    )
  // Knee braces from each post to the header, and a ledger on the wall that carries the rafters.
  for (const z of D.posts)
    for (const dz of [-0.75, 0.75])
      if (z + dz > pz0 && z + dz < pz1)
        beam(
          g,
          [D.postX, D.header - 0.6, z],
          [D.postX, D.header + 0.02, z + dz],
          0.1,
          0x6b4026,
        )
  beam(
    g,
    [D.x1 + 0.06, porchY(px0) - 0.2, D.z0],
    [D.x1 + 0.06, porchY(px0) - 0.2, D.z1],
    0.12,
    0x6b4026,
  )
  // The porch deck: planks along z, three shades, a hair above the deck.
  k = 0
  for (let x = -3.5; x < 0.5 - 0.01; x += 0.25, k++)
    outQuad(
      g,
      [x, 0.356, -3],
      [x, 0.356, 7],
      [x + 0.24, 0.356, 7],
      [x + 0.24, 0.356, -3],
      [x, -50, 2],
      shades[(k * 2) % 3]!,
    )
  // Plank seams on the walls: a dark line every 0.32 m, on all four faces, and corner boards.
  for (let y = 0.72; y < D.wallTop - 0.1; y += 0.32) {
    const s = 0.03,
      e = 0.006,
      mid: V3 = [(D.x0 + D.x1) / 2, y, (D.z0 + D.z1) / 2]
    outQuad(
      g,
      [D.x1 + e, y, D.z1],
      [D.x1 + e, y, D.z0],
      [D.x1 + e, y + s, D.z0],
      [D.x1 + e, y + s, D.z1],
      mid,
      0x6e2a1f,
    )
    outQuad(
      g,
      [D.x0 - e, y, D.z0],
      [D.x0 - e, y, D.z1],
      [D.x0 - e, y + s, D.z1],
      [D.x0 - e, y + s, D.z0],
      mid,
      0x6e2a1f,
    )
    outQuad(
      g,
      [D.x0, y, D.z0 - e],
      [D.x0, y + s, D.z0 - e],
      [D.x1, y + s, D.z0 - e],
      [D.x1, y, D.z0 - e],
      mid,
      0x6e2a1f,
    )
    outQuad(
      g,
      [D.x1, y, D.z1 + e],
      [D.x1, y + s, D.z1 + e],
      [D.x0, y + s, D.z1 + e],
      [D.x0, y, D.z1 + e],
      mid,
      0x6e2a1f,
    )
  }
  for (const x of [D.x0, D.x1])
    for (const z of [D.z0, D.z1])
      g.box([x, 0.4, z], [0.16, D.wallTop - 0.4, 0.16], 0x6b4026)
  // Window muntins (four panes) and sills.
  for (const [z, w] of WINDOWS) {
    g.box([-3.86, 1.3, z], [0.04, 1.4, 0.06], 0x5a3420)
    g.box([-3.86, 1.97, z], [0.04, 0.06, w], 0x5a3420)
    g.box([-3.86, 1.05, z], [0.18, 0.08, w + 0.4], 0x6b4026)
  }
  // The door, between the first window and the second: a frame, plank leaves, a brass knob.
  g.box([-3.95, 0.4, 0.55], [0.08, 2.35, 1.2], 0x5a3420)
  for (const [dz, hex] of [
    [-0.25, 0x7a4a2b],
    [0, 0x6b4026],
    [0.25, 0x7a4a2b],
  ] as const)
    g.box([-3.9, 0.4, 0.55 + dz], [0.05, 2.2, 0.24], hex)
  g.box([-3.86, 1.35, 0.92], [0.06, 0.08, 0.08], 0xc9a227)
  // The bench under the middle window's right: seat, back, four legs.
  g.box([-3.55, 0.76, 3.9], [0.45, 0.07, 1.5], 0x8a5a36, 0, 0x9c6a40)
  g.box([-3.86, 0.95, 3.9], [0.06, 0.42, 1.5], 0x7a4a2b)
  for (const x of [-3.72, -3.4])
    for (const z of [3.25, 4.55])
      g.box([x, 0.35, z], [0.07, 0.41, 0.07], 0x5a3420)
}

/** A barrel with two iron hoops, s times a 0.9 m barrel, standing at (x, y, z). */
function barrel(g: Geo, x: number, y: number, z: number, s: number): void {
  lathe(
    g,
    x,
    z,
    [
      [0.29 * s, y],
      [0.33 * s, y + 0.22 * s],
      [0.345 * s, y + 0.45 * s],
      [0.33 * s, y + 0.68 * s],
      [0.29 * s, y + 0.9 * s],
    ],
    10,
    [0x8a5a36, 0x9a6a40, 0x9a6a40, 0x8a5a36],
  )
  for (const at of [0.14, 0.72])
    lathe(
      g,
      x,
      z,
      [
        [0.335 * s + 0.012, y + at * s],
        [0.345 * s + 0.012, y + (at + 0.06) * s],
      ],
      10,
      0x3f3a38,
      false,
    )
}

/** The porch's props: barrels, the wall lantern and the bell. */
function depotProps(): void {
  const D = DEPOT,
    g = hero
  // Barrels with iron hoops: two at the porch's north end, two by the depot's south wall.
  barrel(g, -0.25, 0.35, 6.45, 1)
  barrel(g, -0.95, 0.35, 6.6, 0.9)
  barrel(g, -5.1, 0, -3.45, 1)
  barrel(g, -5.85, 0, -3.6, 0.95)
  // The wall lantern by the door: an iron bracket, a base, a lit glass, four corner rods and a cap.
  const L: V3 = [-3.72, 1.98, -0.45]
  beam(g, [D.x1, 2.5, L[2]], [L[0], 2.5, L[2]], 0.04, 0x2f2a28)
  beam(g, [L[0], 2.5, L[2]], [L[0], L[1] + 0.48, L[2]], 0.025, 0x2f2a28)
  g.box(L, [0.22, 0.05, 0.22], 0x3a3330)
  // A box has no bottom; the lantern hangs in the air, so its base gets one (Codex MUST).
  outQuad(
    g,
    [L[0] - 0.11, L[1], L[2] - 0.11],
    [L[0] + 0.11, L[1], L[2] - 0.11],
    [L[0] + 0.11, L[1], L[2] + 0.11],
    [L[0] - 0.11, L[1], L[2] + 0.11],
    [L[0], L[1] + 1, L[2]],
    0x2f2a28,
  )
  heroGlow.box([L[0], L[1] + 0.05, L[2]], [0.17, 0.3, 0.17], 0xffc45a)
  for (const dx of [-0.1, 0.1])
    for (const dz of [-0.1, 0.1])
      beam(
        g,
        [L[0] + dx, L[1] + 0.05, L[2] + dz],
        [L[0] + dx, L[1] + 0.35, L[2] + dz],
        0.025,
        0x3a3330,
      )
  lathe(
    g,
    L[0],
    L[2],
    [
      [0.15, L[1] + 0.35],
      [0.04, L[1] + 0.46],
    ],
    4,
    0x3a3330,
  )
  // The brass bell on an iron bracket off the wall, by the rack.
  metal(() => {
    depotBell(g)
  })
}

/** The porch's bell (LF2-7: all metal): an iron bracket off the wall, the brass bell and its clapper. */
function depotBell(g: Geo): void {
  const D = DEPOT,
    B: V3 = [-3.25, 2.24, -1.15]
  beam(g, [D.x1, 2.78, B[2]], [B[0] - 0.05, 2.78, B[2]], 0.06, 0x2f2a28)
  beam(g, [D.x1, 2.35, B[2]], [-3.55, 2.78, B[2]], 0.04, 0x2f2a28)
  beam(g, [B[0], 2.78, B[2]], [B[0], 2.6, B[2]], 0.03, 0x2f2a28)
  lathe(
    g,
    B[0],
    B[2],
    [
      [0.16, B[1]],
      [0.145, B[1] + 0.04],
      [0.11, B[1] + 0.13],
      [0.095, B[1] + 0.26],
      [0.05, B[1] + 0.34],
    ],
    10,
    [0xd8b040, 0xc9a227, 0xb8921e, 0xc9a227],
  )
  lathe(
    g,
    B[0],
    B[2],
    [
      [0.035, B[1] - 0.04],
      [0.035, B[1] + 0.02],
    ],
    6,
    0x6b5a2a,
  ) // the clapper
}

/** The rack, its rifle and the ammo crate. */
function depotRack(): void {
  const g = hero
  // The rack (the `rack` empty, -2.2, 1.12, -0.92): a plank board on two posts across the porch's south end,
  // two pairs of pegs, the lever-action resting on them.
  for (const x of [-3.45, -0.95])
    g.box([x, 0.35, -1.06], [0.1, 1.1, 0.1], 0x5a3420)
  for (const [y, hex] of [
    [0.86, 0x8a5a36],
    [1.13, 0x7a4a2b],
  ] as const)
    g.box([-2.2, y, -1.07], [2.4, 0.27, 0.06], hex)
  g.box([-2.2, 1.4, -1.07], [2.56, 0.06, 0.12], 0x5a3420, 0, 0x6b4026) // the cap rail
  for (const x of [-3.05, -1.4])
    for (const y of [0.97, 1.24])
      beam(g, [x, y, -1.04], [x, y + 0.03, -0.86], 0.035, 0xb8921e)
  // The lever-action: a walnut stock, a brass receiver with its lever loop, a barrel over its magazine tube. It is
  // `rack.rifle`'s own node, so a panel can hide it once taken; the rack, pegs and crate stay in `hero`.
  const r = -0.92,
    gun = rackRifle
  beam(gun, [-3.2, 1.0, r], [-2.62, 1.09, r], 0.11, 0x5a3420) // stock
  beam(gun, [-2.62, 1.09, r], [-2.47, 1.11, r], 0.07, 0x5a3420) // wrist
  gun.box([-2.31, 1.05, r], [0.32, 0.12, 0.075], 0xc9a227, 0, 0xe0b830) // receiver
  beam(gun, [-2.42, 1.04, r], [-2.42, 0.95, r], 0.025, 0xb8921e)
  beam(gun, [-2.42, 0.95, r], [-2.27, 0.95, r], 0.025, 0xb8921e)
  beam(gun, [-2.27, 0.95, r], [-2.2, 1.04, r], 0.025, 0xb8921e) // the lever loop
  beam(gun, [-2.15, 1.145, r], [-1.15, 1.145, r], 0.035, 0x2f3338) // barrel
  beam(gun, [-2.15, 1.1, r], [-1.3, 1.1, r], 0.03, 0x3a3e44) // magazine tube
  beam(gun, [-2.15, 1.115, r], [-1.75, 1.115, r], 0.07, 0x6b3a22) // fore-end
  // The ammo crate in front of the rack: X-braced sides and two cartridge boxes on top.
  const C: V3 = [-3.1, 0.35, -0.45],
    cs = 0.5
  g.box(C, [cs, cs, cs], 0x9a6a40, 0, 0xa8784a)
  const cx0 = C[0] - cs / 2,
    cx1 = C[0] + cs / 2,
    cz0 = C[2] - cs / 2,
    cz1 = C[2] + cs / 2,
    cy0 = C[1] + 0.03,
    cy1 = C[1] + cs - 0.03
  for (const [a, b] of [
    [
      [cx0 + 0.03, cy0, cz1 + 0.01],
      [cx1 - 0.03, cy1, cz1 + 0.01],
    ],
    [
      [cx0 + 0.03, cy1, cz1 + 0.01],
      [cx1 - 0.03, cy0, cz1 + 0.01],
    ],
    [
      [cx1 + 0.01, cy0, cz0 + 0.03],
      [cx1 + 0.01, cy1, cz1 - 0.03],
    ],
    [
      [cx1 + 0.01, cy1, cz0 + 0.03],
      [cx1 + 0.01, cy0, cz1 - 0.03],
    ],
  ] as const)
    beam(g, a, b, 0.04, 0x6b4026)
  g.box(
    [C[0] - 0.08, C[1] + cs, C[2] - 0.04],
    [0.2, 0.12, 0.16],
    0xc9a227,
    0.2,
    0xe0b830,
  )
  g.box(
    [C[0] + 0.12, C[1] + cs, C[2] + 0.06],
    [0.16, 0.09, 0.12],
    0xb8322a,
    -0.3,
  )
}

/** The BRASSCAP sign. */
function depotSign(): void {
  const D = DEPOT,
    g = hero
  // The BRASSCAP sign, standing on the porch roof's south edge and facing down the canyon, so the trail sees
  // it and the porch's ceiling hides it from spawn: a framed board on two posts, raised letters.
  // Seen from -z, the reader's right is -x, so the letters run from +x to -x.
  const [sz] = D.porchZ,
    zf = sz - 0.04,
    sx = -1.5,
    sy = porchY(-3.7) + 0.02
  for (const x of [-3.2, 0.2])
    beam(
      g,
      [x, porchY(x) - 0.05, sz + 0.12],
      [x, sy + 0.8, sz + 0.12],
      0.1,
      0x5a3420,
    )
  g.box([sx, sy, sz + 0.02], [4.4, 0.9, 0.06], 0x4a2c1a)
  for (const y0 of [sy - 0.05, sy + 0.88])
    g.box([sx, y0, zf], [4.6, 0.08, 0.06], 0x8a5a36)
  const unit = 0.112,
    word = 'BRASSCAP',
    pitch = 4.1,
    left = sx + ((word.length * pitch - 1.1) * unit) / 2
  for (const [i, ch] of word.split('').entries())
    for (const [u0, v0, u1, v1] of LETTERS[ch]!) {
      const len = Math.hypot(u1 - u0, v1 - v0),
        du = ((u1 - u0) / len) * 0.35,
        dv = ((v1 - v0) / len) * 0.35
      const p = (u: number, v: number): V3 => [
        left - (i * pitch + u) * unit,
        sy + 0.17 + v * unit,
        zf - 0.04,
      ]
      beam(g, p(u0 - du, v0 - dv), p(u1 + du, v1 + dv), 0.08, 0xf0dcae)
    }
}

/** The handcar on the rail's siding. */
function depotHandcar(): void {
  const g = hero
  // The handcar on the siding: a plank deck on four wheels that sit on the rails, the pump's A-frame and its
  // walking beam. `on` places a point given across (lx) and along (lz) the track, which leans as the line curves.
  const t = 12,
    [hx, hz] = railPath(t),
    [hx2, hz2] = railPath(t + 1),
    yaw = Math.atan2(hx2 - hx, -(hz2 - hz)),
    slope = (hx2 - hx) / (hz2 - hz),
    on = (lx: number, y: number, lz: number): V3 => [
      hx + lx + slope * lz,
      y,
      hz + lz,
    ]
  g.box(on(0, 0.5, 0), [1.2, 0.12, 2.1], 0xb8862a, -yaw, 0xc9963a)
  for (const s of [-0.7, 0.7])
    for (const f of [-0.65, 0.65])
      wheel(g, on(s, 0.42, f), 0.22, 0.07, 10, 0x3a3330)
  for (const s of [-1, 1])
    beam(g, on(-0.35, 0.62, s * 0.45), on(0, 1.38, 0), 0.07, 0xb8862a)
  beam(g, on(0, 1.4, -0.85), on(0, 1.4, 0.85), 0.06, 0x8a6a2a)
  for (const s of [-1, 1])
    beam(g, on(-0.45, 1.4, s * 0.85), on(0.45, 1.4, s * 0.85), 0.05, 0x5a3420)
}

/** The hero's detail (LF2-5), in the depot's own GLB: tin, planks, rafters, the sign and the props. */
function depotDetail(): void {
  metal(depotTin)
  depotWood()
  depotProps()
  depotRack()
  depotSign()
  depotHandcar()
}

/** LF2-6's own fixed-seed generator (the fire stones), so nothing BM-1, LF2-2 or LF2-4 placed moves. */
let rc = lcg(2606)

/** Toward the sun (LF2-3: azimuth 50, 16 degrees up, down the canyon and right of the gate), for a lit side. */
const SUN: V3 = (() => {
  const v = [0.74, 0.28, -0.62] as const,
    l = Math.hypot(v[0], v[1], v[2])
  return [v[0] / l, v[1] / l, v[2] / l] as const
})()

/** Appends `from`, turned `yaw` round the vertical as `Geo.box` turns (+z goes to (sin, cos)) and moved to
 *  (x, y, z), to `to`. A turn keeps the winding, so faces still face out. */
function place(
  to: Geo,
  from: Geo,
  x: number,
  y: number,
  z: number,
  yaw: number,
): void {
  const c = Math.cos(yaw),
    s = Math.sin(yaw)
  for (let i = 0; i < from.pos.length; i += 3) {
    const px = from.pos[i]!,
      pz = from.pos[i + 2]!,
      nx = from.nor[i]!,
      nz = from.nor[i + 2]!
    to.pos.push(x + px * c + pz * s, y + from.pos[i + 1]!, z - px * s + pz * c)
    to.nor.push(nx * c + nz * s, from.nor[i + 1]!, -nx * s + nz * c)
  }
  for (const v of from.col) to.col.push(v)
  for (const v of from.mat) to.mat.push(v)
}

/** A thin sheet: the quad facing away from `centre` in `out`, and its back in `back`, so it reads from both sides. */
function sheet(
  g: Geo,
  a: V3,
  b: V3,
  c: V3,
  d: V3,
  centre: V3,
  out: Hex,
  back: Hex,
): void {
  outQuad(g, a, b, c, d, centre, out)
  const mid = [0, 1, 2].map(k => (a[k]! + c[k]!) / 2)
  outQuad(
    g,
    a,
    b,
    c,
    d,
    [2 * mid[0]! - centre[0], 2 * mid[1]! - centre[1], 2 * mid[2]! - centre[2]],
    back,
  )
}

/** A hanging lantern with its base at (x, y, z): an iron base and cap, a lit glass in `lit`, four corner rods. */
function lantern(g: Geo, lit: Geo, x: number, y: number, z: number): void {
  g.box([x, y, z], [0.2, 0.05, 0.2], 0x3a3330)
  outQuad(
    g,
    [x - 0.1, y, z - 0.1],
    [x + 0.1, y, z - 0.1],
    [x + 0.1, y, z + 0.1],
    [x - 0.1, y, z + 0.1],
    [x, y + 1, z],
    0x2f2a28,
  )
  lit.box([x, y + 0.05, z], [0.15, 0.26, 0.15], 0xffc45a)
  for (const dx of [-0.09, 0.09])
    for (const dz of [-0.09, 0.09])
      beam(
        g,
        [x + dx, y + 0.05, z + dz],
        [x + dx, y + 0.31, z + dz],
        0.022,
        0x3a3330,
      )
  lathe(
    g,
    x,
    z,
    [
      [0.14, y + 0.31],
      [0.04, y + 0.41],
    ],
    4,
    0x3a3330,
  )
}

/** A small faceted stone: a five-sided base ring, a turned shoulder ring and an off-centre apex. */
function pebble(
  g: Geo,
  x: number,
  y: number,
  z: number,
  r: number,
  h: number,
  hex: Hex,
): void {
  const turn = rc() * Math.PI,
    at = (k: number, rr: number, yy: number, off: number): V3 => {
      const a = turn + ((k + off) / 5) * Math.PI * 2
      return [x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr]
    }
  const apex: V3 = [
      x + (rc() - 0.5) * r * 0.4,
      y + h,
      z + (rc() - 0.5) * r * 0.4,
    ],
    centre: V3 = [x, y + h * 0.35, z]
  for (let k = 0; k < 5; k++) {
    outQuad(
      g,
      at(k, r, y - 0.02, 0),
      at(k + 1, r, y - 0.02, 0),
      at(k + 1, r * 0.72, y + h * 0.6, 0.5),
      at(k, r * 0.72, y + h * 0.6, 0.5),
      centre,
      hex,
    )
    outTri(
      g,
      at(k, r * 0.72, y + h * 0.6, 0.5),
      at(k + 1, r * 0.72, y + h * 0.6, 0.5),
      apex,
      centre,
      mix(hex, 0xd8cfc0, 0.25),
    )
  }
}

/** A flame tongue: a five-sided spike from a base of radius r at (x, y, z), leaning (lx, lz) to its tip h up. */
function tongue(
  g: Geo,
  x: number,
  y: number,
  z: number,
  r: number,
  h: number,
  lx: number,
  lz: number,
  hex: Hex,
): void {
  const at = (k: number, rr: number, yy: number, f: number): V3 => {
    const a = (k / 5) * Math.PI * 2
    return [x + lx * f + Math.cos(a) * rr, yy, z + lz * f + Math.sin(a) * rr]
  }
  const tip: V3 = [x + lx, y + h, z + lz]
  for (let k = 0; k < 5; k++) {
    outQuad(
      g,
      at(k, r, y, 0),
      at(k + 1, r, y, 0),
      at(k + 1, r * 0.7, y + h * 0.4, 0.3),
      at(k, r * 0.7, y + h * 0.4, 0.3),
      [x + lx * 0.15, y + h * 0.2, z + lz * 0.15],
      hex,
    )
    outTri(
      g,
      at(k, r * 0.7, y + h * 0.4, 0.3),
      at(k + 1, r * 0.7, y + h * 0.4, 0.3),
      tip,
      [x + lx * 0.65, y + h * 0.7, z + lz * 0.65],
      hex,
    )
  }
}

const STONES: readonly Hex[] = [0x8a7f74, 0x9d9184, 0x786c62, 0xa69a8a]

/** A campfire: a ring of faceted stones, three crossed charred logs, glowing embers and a flame of tongues. */
function campfire(x: number, y: number, z: number): void {
  const g = props,
    lit = propsGlow
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rc() * 0.25,
      r = 0.15 + rc() * 0.07
    pebble(
      g,
      x + Math.cos(a) * 0.72,
      y,
      z + Math.sin(a) * 0.72,
      r,
      r * (0.9 + rc() * 0.5),
      STONES[i % STONES.length]!,
    )
  }
  for (const a of [0.3, 1.35, 2.4]) {
    const dx = Math.cos(a) * 0.48,
      dz = Math.sin(a) * 0.48
    beam(
      g,
      [x - dx, y + 0.07, z - dz],
      [x + dx, y + 0.13, z + dz],
      0.1,
      0x3a2a20,
    )
  }
  // Embers: a low lit disc under the logs, facing up.
  for (let k = 0; k < 6; k++) {
    const a0 = (k / 6) * Math.PI * 2,
      a1 = ((k + 1) / 6) * Math.PI * 2
    outTri(
      lit,
      [x, y + 0.03, z],
      [x + Math.cos(a0) * 0.42, y + 0.03, z + Math.sin(a0) * 0.42],
      [x + Math.cos(a1) * 0.42, y + 0.03, z + Math.sin(a1) * 0.42],
      [x, y - 1, z],
      0xff6a1a,
    )
  }
  // The flame: an orange core and yellow tongues licking out of it.
  tongue(lit, x, y + 0.05, z, 0.27, 1.0, 0.02, -0.03, 0xff8424)
  for (const [a, h] of [
    [0.4, 0.7],
    [2.5, 0.6],
    [4.4, 0.78],
  ] as const) {
    const ox = Math.cos(a) * 0.17,
      oz = Math.sin(a) * 0.17
    tongue(lit, x + ox, y + 0.05, z + oz, 0.12, h, ox * 0.6, oz * 0.6, 0xffc23a)
  }
  tongue(lit, x, y + 0.05, z, 0.33, 0.42, 0, 0, 0xff6a1a)
}

/** An X-braced crate s m a side, its base at (x, y, z), turned `yaw`: a frame and an X on each side. */
function crate(x: number, y: number, z: number, s: number, yaw: number): void {
  const c = new Geo(),
    face = new Geo(),
    h = s / 2,
    w = s * 0.09,
    zf = h + w * 0.2,
    lo = w / 2,
    hi = s - w / 2,
    e = h - w / 2
  c.box([0, 0, 0], [s, s, s], 0x8a5a36, 0, 0x9c6a40)
  beam(face, [-e, lo, zf], [e, lo, zf], w, 0x6b4026)
  beam(face, [-e, hi, zf], [e, hi, zf], w, 0x6b4026)
  beam(face, [-e, lo, zf], [-e, hi, zf], w, 0x6b4026)
  beam(face, [e, lo, zf], [e, hi, zf], w, 0x6b4026)
  beam(face, [-e, lo, zf], [e, hi, zf], w * 0.85, 0x7a4a2b)
  beam(face, [e, lo, zf], [-e, hi, zf], w * 0.85, 0x7a4a2b)
  for (let k = 0; k < 4; k++) place(c, face, 0, 0, 0, (k * Math.PI) / 2)
  place(props, c, x, y, z, yaw)
}

const CANVAS: readonly Hex[] = [0xf0dfba, 0xe6d3aa, 0xf3e4c2]

/** A ridge tent on (x, y, z), its door end turned `yaw` from +z: canvas slopes in panels with seams, a door with its
 *  flaps tied back on a glow from inside, the ridge and back poles, and a lantern hung inside the door. Its
 *  footprint is the plain tent's, give or take a tenth of a metre. */
function tent(x: number, y: number, z: number, yaw: number): void {
  const t = new Geo(),
    lit = new Geo(),
    w = 1.6,
    l = 2.6,
    h = 2.2,
    dw = 0.55,
    dh = 1.65
  for (const side of [-1, 1])
    for (let k = 0; k < 3; k++) {
      const z0 = -l + (2 * l * k) / 3,
        z1 = -l + (2 * l * (k + 1)) / 3,
        hex = CANVAS[k]!
      outQuad(
        t,
        [side * w, 0, z0],
        [side * w, 0, z1],
        [0, h, z1],
        [0, h, z0],
        [0, 0.7, (z0 + z1) / 2],
        side < 0 ? hex : mix(hex, 0xb89a72, 0.25),
      )
    }
  for (const side of [-1, 1]) {
    for (const zs of [-l / 3, l / 3])
      beam(t, [side * w, 0.02, zs], [0, h, zs], 0.035, 0xc4ad82)
    beam(
      t,
      [side * w * 0.985, 0.07, -l],
      [side * w * 0.985, 0.07, l],
      0.09,
      0xb59a6e,
    )
  }
  outTri(t, [w, 0, -l], [-w, 0, -l], [0, h, -l], [0, 1, 0], 0xd9c69e)
  outQuad(
    t,
    [-w, 0, l],
    [-dw, 0, l],
    [0, dh, l],
    [0, h, l],
    [0, 1, 0],
    0xe2cfa6,
  )
  outQuad(t, [dw, 0, l], [w, 0, l], [0, h, l], [0, dh, l], [0, 1, 0], 0xe2cfa6)
  // The flaps, rolled back either side of the door, and their ties.
  for (const side of [-1, 1]) {
    const a: V3 = [side * (dw + 0.02), 0.02, l + 0.05],
      b: V3 = [side * 0.06, dh - 0.05, l + 0.05],
      c: V3 = [side * (dw + 0.5), 0.42, l + 0.08]
    t.tri(a, b, c, 0xd6c094)
    t.tri(a, c, b, 0xc4a878)
    beam(
      t,
      [side * 0.45, 0.62, l + 0.03],
      [side * 0.62, 0.6, l + 0.09],
      0.03,
      0x8a6a3a,
    )
  }
  // The glow inside, a little in from the door, wider than it so it fills the opening from the side.
  outTri(
    lit,
    [-dw * 1.25, 0.01, l - 0.25],
    [dw * 1.25, 0.01, l - 0.25],
    [0, dh * 1.15, l - 0.25],
    [0, 0.6, l - 1],
    0xffb653,
  )
  // The ridge pole and the back pole; the door end has none, so nothing stands proud of the plain tent's
  // footprint where the walks and the standoffs pass (a front pole and its lantern stopped camp 2's).
  beam(t, [0, h + 0.03, -l - 0.15], [0, h + 0.03, l + 0.12], 0.08, 0x5e3a22)
  beam(t, [0, 0, -l - 0.12], [0, h + 0.03, -l - 0.12], 0.075, 0x5e3a22)
  // The lantern hangs from the ridge just inside the door, in front of the glow.
  beam(t, [0, h - 0.04, l - 0.14], [0, 1.82, l - 0.14], 0.02, 0x2f2a28)
  lantern(t, lit, 0, 1.41, l - 0.14)
  place(props, t, x, y, z, yaw)
  place(propsGlow, lit, x, y, z, yaw)
}

/** Each camp's tent door heading, its crates' x offset and its barrels (offsets from the empty, a scale), behind
 *  the tent, off the walks and the lines of fire. Camp 3's tent turns its door down the slot to the gate, which
 *  keeps it a metre off the walk in, and its crates step east to clear the turned tent. */
const CAMP_DETAIL: readonly {
  readonly door: number
  readonly crates: number
  readonly barrels: readonly (readonly [number, number, number])[]
}[] = [
  {
    door: 0,
    crates: 0,
    barrels: [
      [-4.4, 1.2, 1],
      [-4.0, -0.2, 0.9],
    ],
  },
  { door: 0, crates: 0, barrels: [] },
  {
    door: Math.atan2(-SIDE.u[0], -SIDE.u[1]),
    crates: 1,
    barrels: [[3.0, -0.4, 1]],
  },
]

/** A camp's detail (LF2-6) on the plain camp's footprint: the tent (camp 3's turned to the gate), the fire, two
 *  X-braced crates, the flag, barrels, and at camp 3 the wagon with its torn cover. */
function campDetail(i: number, x: number, y: number, z: number): void {
  const at = CAMP_DETAIL[i]!
  tent(x, y, z, at.door)
  campfire(x - 2.8, y, z + 2.5)
  crate(x + 2.6 + at.crates, y, z + 1, 1, 0.3)
  crate(x + 2.4 + at.crates, y + 1, z + 1, 0.7, 0.7)
  props.cylinder([x + 1.8, y, z - 2], 0.06, 7, 5, 0x5e3a22)
  sheet(
    props,
    [x + 1.8, y + 6.2, z - 2],
    [x + 3.2, y + 6.45, z - 2],
    [x + 3.2, y + 6.95, z - 2],
    [x + 1.8, y + 6.9, z - 2],
    [x + 2.5, y + 6.6, z - 3],
    0xc93a2c,
    0xb0302a,
  )
  for (const [dx, dz, s] of at.barrels) barrel(props, x + dx, y, z + dz, s)
  if (i === 2) {
    const { gate: g0, u } = SIDE,
      n = [-u[1], u[0]] as const,
      s = 24.2,
      o = 2.2
    wagon(
      g0[0] + u[0] * s + n[0] * o,
      g0[1] + u[1] * s + n[1] * o,
      Math.atan2(-n[0], -n[1]),
    )
  }
}

/** The wagon at camp 3: a plank bed on four spoked-looking wheels, a tongue on the ground and a canvas cover on
 *  hoops, torn through on one side with a flap hanging. Built along +z, its tongue forward. */
function wagon(x: number, z: number, yaw: number): void {
  const g = new Geo(),
    wood = 0x7a4a2b,
    dark = 0x5e3a22
  g.box([0, 0.6, 0], [1.4, 0.16, 3.0], dark, 0, 0x8a5a36)
  outQuad(
    g,
    [-0.7, 0.6, -1.5],
    [0.7, 0.6, -1.5],
    [0.7, 0.6, 1.5],
    [-0.7, 0.6, 1.5],
    [0, 2, 0],
    dark,
  )
  for (const sx of [-1, 1]) g.box([sx * 0.66, 0.76, 0], [0.08, 0.36, 3.0], wood)
  for (const sz of [-1, 1])
    g.box([0, 0.76, sz * 1.46], [1.24, 0.36, 0.08], wood)
  for (const sz of [-1, 1]) {
    beam(g, [-0.86, 0.52, sz], [0.86, 0.52, sz], 0.08, dark)
    for (const sx of [-1, 1]) {
      const r = sz < 0 ? 0.52 : 0.44
      wheel(g, [sx * 0.82, r, sz], r, 0.08, 12, 0x6b4026)
      wheel(g, [sx * 0.88, r, sz], 0.11, 0.12, 6, 0x3a3330)
    }
  }
  beam(g, [0, 0.5, 1.5], [0, 0.12, 2.9], 0.09, dark)
  beam(g, [-0.45, 0.12, 2.85], [0.45, 0.12, 2.85], 0.07, dark)
  // The cover: canvas on hoops over the bed, torn through on the left in the middle bay.
  const R = 0.72,
    cy = 0.94,
    seg = 6,
    hoops = [-1.35, -0.68, 0, 0.68, 1.35],
    arc = (k: number, zz: number, rr = R): V3 => {
      const a = Math.PI * (k / seg)
      return [Math.cos(a) * rr, cy + Math.sin(a) * rr, zz]
    }
  for (const zh of [hoops[0]!, hoops.at(-1)!])
    for (let k = 0; k < seg; k++)
      beam(g, arc(k, zh, R + 0.02), arc(k + 1, zh, R + 0.02), 0.05, wood)
  const torn = new Set(['2:4', '2:5', '1:5', '3:4'])
  for (let b = 0; b + 1 < hoops.length; b++)
    for (let k = 0; k < seg; k++) {
      if (torn.has(`${b}:${k}`)) continue
      const z0 = hoops[b]!,
        z1 = hoops[b + 1]!
      sheet(
        g,
        arc(k, z0),
        arc(k + 1, z0),
        arc(k + 1, z1),
        arc(k, z1),
        [0, cy, (z0 + z1) / 2],
        (b + k) % 2 === 0 ? 0xeadab4 : 0xe0cca2,
        0xa88c66,
      )
    }
  // Torn edges: a flap hanging out of the hole and a ragged strip.
  const h0 = arc(4, -0.68),
    h1 = arc(4, 0)
  g.tri(h0, h1, [h1[0] - 0.25, h1[1] - 0.55, -0.2], 0xe4d0a6)
  g.tri(h0, [h1[0] - 0.25, h1[1] - 0.55, -0.2], h1, 0xa88c66)
  const r0 = arc(5, 0.68),
    r1 = arc(5, 1.35)
  g.tri(r0, r1, [r0[0] - 0.12, r0[1] - 0.35, 1.05], 0xe0cca2)
  g.tri(r0, [r0[0] - 0.12, r0[1] - 0.35, 1.05], r1, 0xa88c66)
  place(props, g, x, 0, z, yaw)
}

const OLIVE_DARK = 0x4f6a2c,
  OLIVE_LIT = 0xa8b552

/** A ribbed cactus limb from a to b, r m round: a star ring of `ribs` ribs, each face shaded by how it faces the sun
 *  (a lit side), with a domed cap at b when `cap`. */
function ribbed(g: Geo, a: V3, b: V3, r: number, cap: boolean, ribs = 8): void {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
    len = Math.hypot(d[0]!, d[1]!, d[2]!),
    f = d.map(v => v / len)
  let s = Math.abs(f[1]!) > 0.9 ? [1, 0, 0] : [-f[2]!, 0, f[0]!]
  const sl = Math.hypot(s[0]!, s[1]!, s[2]!)
  s = s.map(v => v / sl)
  const t = [
    f[1]! * s[2]! - f[2]! * s[1]!,
    f[2]! * s[0]! - f[0]! * s[2]!,
    f[0]! * s[1]! - f[1]! * s[0]!,
  ]
  const n = ribs * 2,
    dir = (k: number): number[] => {
      const ang = (k / n) * Math.PI * 2
      return [0, 1, 2].map(i => s[i]! * Math.cos(ang) + t[i]! * Math.sin(ang))
    },
    at = (p: V3, k: number, rr: number, up = 0): V3 => {
      const q = dir(k),
        rho = k % 2 === 0 ? rr : rr * 0.72
      return [
        p[0] + q[0]! * rho + f[0]! * up,
        p[1] + q[1]! * rho + f[1]! * up,
        p[2] + q[2]! * rho + f[2]! * up,
      ]
    },
    shade = (k: number, lift = 0): Hex => {
      const q = dir(k + 0.5),
        lit = q[0]! * SUN[0] + q[1]! * SUN[1] + q[2]! * SUN[2] + lift
      // Each rib's two flanks differ a little too, so the ribs read even on the shadow side.
      return mix(
        OLIVE_DARK,
        OLIVE_LIT,
        Math.max(
          0.08,
          Math.min(1, 0.5 + lit * 0.45 + (k % 2 === 0 ? 0.14 : -0.1)),
        ),
      )
    }
  const mid: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
  for (let k = 0; k < n; k++)
    outQuad(
      g,
      at(a, k, r),
      at(a, k + 1, r),
      at(b, k + 1, r),
      at(b, k, r),
      mid,
      shade(k),
    )
  if (!cap) return
  const top: V3 = [
      b[0] + f[0]! * r * 0.7,
      b[1] + f[1]! * r * 0.7,
      b[2] + f[2]! * r * 0.7,
    ],
    inner: V3 = [b[0] - f[0]! * r, b[1] - f[1]! * r, b[2] - f[2]! * r]
  for (let k = 0; k < n; k++) {
    outQuad(
      g,
      at(b, k, r),
      at(b, k + 1, r),
      at(b, k + 1, r * 0.62, r * 0.42),
      at(b, k, r * 0.62, r * 0.42),
      inner,
      shade(k, 0.15),
    )
    outTri(
      g,
      at(b, k, r * 0.62, r * 0.42),
      at(b, k + 1, r * 0.62, r * 0.42),
      top,
      inner,
      shade(k, 0.3),
    )
  }
}

/** A faceted saguaro at (x, z), h m tall: a ribbed trunk and arms (dx, y, up) that run out level, bend and rise. */
function saguaro(
  x: number,
  z: number,
  h: number,
  arms: readonly (readonly [number, number, number])[],
): void {
  const g = props,
    r = 0.34
  ribbed(g, [x, -0.05, z], [x, h - r * 0.6, z], r, true)
  for (const [dx, y, up] of arms) {
    const ra = 0.23,
      sx = Math.sign(dx),
      knee = x + dx - sx * ra * 0.9
    ribbed(g, [x, y, z], [knee, y, z], ra, false)
    ribbed(
      g,
      [knee - sx * ra * 0.6, y - ra * 0.25, z],
      [x + dx, y + ra * 1.3, z],
      ra,
      false,
    )
    ribbed(
      g,
      [x + dx, y + ra * 0.6, z],
      [x + dx, y + up - ra * 0.5, z],
      ra,
      true,
    )
  }
}

/** The gate's double plank doors (BM-4's `gate.door`, the panel field 101 hides and drops): two leaves of planks
 *  with iron straps and rivets on the canyon side, pull rings at the meeting stiles, rails and a brace behind. */
function gateDoors(): void {
  const g = door,
    z = -62,
    front = z + 0.11,
    leaves = [
      [-3.05, 2.02],
      [2.08, 7.15],
    ] as const
  door.box([2.05, 0, z - 0.02], [0.2, 4.4, 0.16], 0x3f2618)
  for (const [li, [x0, x1]] of leaves.entries()) {
    const planks = 6,
      pw = (x1 - x0) / planks
    for (let k = 0; k < planks; k++)
      door.box(
        [x0 + pw * (k + 0.5), 0, z],
        [pw - 0.035, k % 2 === li % 2 ? 4.6 : 4.48, 0.22],
        [0x7a4a2b, 0x6b4026, 0x845232][(k + li) % 3]!,
      )
    for (const y of [0.85, 3.35])
      metal(() => {
        g.box(
          [(x0 + x1) / 2, y, front + 0.03],
          [x1 - x0 - 0.12, 0.28, 0.06],
          0x3a3330,
        )
        for (let k = 0; k < 4; k++)
          g.box(
            [x0 + 0.3 + ((x1 - x0 - 0.6) * k) / 3, y + 0.09, front + 0.08],
            [0.09, 0.09, 0.05],
            0x7a7068,
          )
      })
    // The back: two rails and a brace from the hinge side's foot to the meeting side's top rail.
    for (const y of [1.0, 3.2])
      door.box(
        [(x0 + x1) / 2, y, z - 0.16],
        [x1 - x0 - 0.1, 0.3, 0.1],
        0x5e3a22,
      )
    const hinge = li === 0 ? x0 + 0.2 : x1 - 0.2,
      meet = li === 0 ? x1 - 0.2 : x0 + 0.2
    beam(door, [hinge, 1.2, z - 0.16], [meet, 3.2, z - 0.16], 0.16, 0x5e3a22)
    // A pull ring at the meeting stile.
    const px = li === 0 ? x1 - 0.32 : x0 + 0.32
    metal(() => {
      beam(
        g,
        [px, 2.05, front + 0.07],
        [px, 2.45, front + 0.07],
        0.05,
        0x2f2a28,
      )
    })
  }
}

/** The gate's frame (LF2-6, L0 detail): timber posts in front of the stone pillars, a crossbeam on knee braces
 *  carrying the GATE sign and a hanging lantern, the right post as the lever post with its bell, and a saguaro. */
function gateDetail(): void {
  const g = props,
    zf = -60.55,
    beamY = 4.95
  for (const x of [-3.6, 7.6]) {
    g.box([x, 0, zf], [0.55, 6.25, 0.55], 0x6b4026, 0, 0x5e3a22)
    g.box([x, 6.25, zf], [0.64, 0.1, 0.64], 0x4a2c1a)
    for (const y of [beamY + 0.12, beamY + 0.3])
      g.box([x, y, zf + 0.29], [0.1, 0.1, 0.04], 0x3a3330)
  }
  g.box([2, beamY, zf], [12.4, 0.42, 0.5], 0x7a4a2b, 0, 0x8a5a36)
  beam(g, [-3.33, 3.7, zf], [-2.05, beamY, zf], 0.22, 0x6b4026)
  beam(g, [7.33, 3.7, zf], [6.05, beamY, zf], 0.22, 0x6b4026)
  // The GATE sign on the crossbeam, raised cream letters on a board facing the canyon (+z, read left to right).
  const sy = beamY + 0.42,
    bz = zf + 0.16
  g.box([2, sy, bz], [2.3, 0.8, 0.1], 0x9a6a40)
  for (const y0 of [sy - 0.03, sy + 0.76])
    g.box([2, y0, bz + 0.05], [2.46, 0.08, 0.06], 0x5e3a22)
  for (const x0 of [0.81, 3.19])
    g.box([x0, sy, bz + 0.05], [0.08, 0.84, 0.06], 0x5e3a22)
  const unit = 0.11,
    pitch = 4.1,
    word = 'GATE',
    left = 2 - ((word.length * pitch - 1.1) * unit) / 2
  for (const [i, ch] of word.split('').entries())
    for (const [u0, v0, u1, v1] of LETTERS[ch]!) {
      const len = Math.hypot(u1 - u0, v1 - v0),
        du = ((u1 - u0) / len) * 0.35,
        dv = ((v1 - v0) / len) * 0.35
      const p = (u: number, v: number): V3 => [
        left + (i * pitch + u) * unit,
        sy + 0.13 + v * unit,
        bz + 0.09,
      ]
      beam(g, p(u0 - du, v0 - dv), p(u1 + du, v1 + dv), 0.075, 0xf0dcae)
    }
  // The lantern hung under the crossbeam, right of centre.
  beam(g, [4.2, beamY, zf + 0.1], [4.2, beamY - 0.3, zf + 0.1], 0.025, 0x2f2a28)
  lantern(g, propsGlow, 4.2, beamY - 0.71, zf + 0.1)
  // The right post is the lever post: the brass bell hangs on an iron bracket off the crossbeam above it, and the
  // lever box with its red-gripped lever sits on its face (a post of its own stood in camp 3's and out of the
  // gate's frame).
  const px = 7.6,
    bz0 = zf + 0.62,
    by = beamY - 0.62
  metal(() => {
    gateBell(g, px, bz0, by, zf, beamY)
  })
  g.box([px, 0.85, zf + 0.34], [0.3, 0.42, 0.14], 0x3a3330)
  beam(g, [px, 1.06, zf + 0.43], [px + 0.14, 1.48, zf + 0.55], 0.045, 0x2f2a28)
  beam(
    g,
    [px + 0.14, 1.48, zf + 0.55],
    [px + 0.19, 1.62, zf + 0.59],
    0.07,
    0xc93a2c,
  )
  saguaro(-3.0, -59.6, 3.6, [
    [-0.9, 1.5, 1.2],
    [0.7, 2.2, 0.9],
  ])
}

/** The gate's bell (LF2-7: all metal): an iron bracket off the crossbeam over the lever post, the brass bell and
 *  its clapper. */
function gateBell(
  g: Geo,
  px: number,
  bz0: number,
  by: number,
  zf: number,
  beamY: number,
): void {
  beam(
    g,
    [px, beamY + 0.12, zf + 0.25],
    [px, beamY + 0.12, bz0],
    0.06,
    0x2f2a28,
  )
  beam(g, [px, beamY + 0.12, bz0], [px, by + 0.48, bz0], 0.03, 0x2f2a28)
  lathe(
    g,
    px,
    bz0,
    [
      [0.22, by],
      [0.2, by + 0.05],
      [0.15, by + 0.18],
      [0.13, by + 0.36],
      [0.07, by + 0.48],
    ],
    10,
    [0xd8b040, 0xc9a227, 0xb8921e, 0xc9a227],
  )
  lathe(
    g,
    px,
    bz0,
    [
      [0.045, by - 0.06],
      [0.045, by + 0.02],
    ],
    6,
    0x6b5a2a,
  )
}

/** The water tower's three iron hoops, its tin cone roof and the finial (LF2-7: all metal). */
function towerCap(
  g: Geo,
  x: number,
  z: number,
  R: number,
  staves: number,
): void {
  for (const y of [7.6, 8.9, 10.2])
    lathe(
      g,
      x,
      z,
      [
        [R + 0.04, y],
        [R + 0.04, y + 0.12],
      ],
      staves,
      0x3f3a38,
    )
  lathe(
    g,
    x,
    z,
    [
      [2.75, 10.55],
      [2.75, 10.68],
      [1.3, 11.55],
      [0.14, 12.3],
    ],
    staves,
    [0x8d93a6, 0x9aa0b2, 0x868ca0],
  )
  lathe(
    g,
    x,
    z,
    [
      [0.08, 12.2],
      [0.08, 12.6],
      [0.15, 12.68],
      [0.02, 12.82],
    ],
    6,
    0x6b625a,
  )
}

/** The water tower's detail (LF2-6): legs leaning in on X-braces, a plank deck, a stave tank with three iron
 *  hoops under a tin cone roof, a spout and a ladder. */
function towerDetail(x: number, z: number): void {
  const g = props,
    leg = (sx: number, sz: number, y: number): V3 => {
      const k = 1.75 - (0.35 * y) / 7
      return [x + sx * k, y, z + sz * k]
    },
    corners = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const
  for (const [sx, sz] of corners)
    beam(g, leg(sx, sz, 0), leg(sx, sz, 7.05), 0.3, 0x4f3322)
  for (let k = 0; k < 4; k++) {
    const [ax, az] = corners[k]!,
      [bx, bz] = corners[(k + 1) % 4]!
    for (const [y0, y1] of [
      [0.5, 3.4],
      [3.6, 6.7],
    ] as const) {
      beam(g, leg(ax, az, y0), leg(bx, bz, y1), 0.12, 0x5e3a22)
      beam(g, leg(bx, bz, y0), leg(ax, az, y1), 0.12, 0x5e3a22)
    }
    beam(g, leg(ax, az, 3.5), leg(bx, bz, 3.5), 0.14, 0x6b4026)
  }
  g.box([x, 7.05, z], [3.9, 0.18, 3.9], 0x6b4026, 0, 0x7a4a2b)
  const R = 2.4,
    staves = 18,
    y0 = 7.23,
    y1 = 10.6
  for (let i = 0; i < staves; i++) {
    const a0 = (-i / staves) * Math.PI * 2,
      a1 = (-(i + 1) / staves) * Math.PI * 2
    outQuad(
      g,
      [x + Math.cos(a0) * R, y0, z + Math.sin(a0) * R],
      [x + Math.cos(a1) * R, y0, z + Math.sin(a1) * R],
      [x + Math.cos(a1) * R, y1, z + Math.sin(a1) * R],
      [x + Math.cos(a0) * R, y1, z + Math.sin(a0) * R],
      [x, (y0 + y1) / 2, z],
      [0x8a5a36, 0x9a6a40, 0x7e5030][i % 3]!,
    )
  }
  // LF2-7: the hoops, the tin cone roof and its finial are metal.
  metal(() => {
    towerCap(g, x, z, R, staves)
  })
  // The spout off the tank's west side, and a ladder up the west face to the deck.
  beam(
    g,
    [x - R + 0.05, 9.4, z + 0.6],
    [x - R - 0.85, 8.9, z + 0.6],
    0.14,
    0x6b6f78,
  )
  beam(
    g,
    [x - R - 0.85, 8.95, z + 0.6],
    [x - R - 0.85, 8.1, z + 0.6],
    0.12,
    0x6b6f78,
  )
  for (const dz of [-0.25, 0.25])
    beam(g, [x - 2.05, 0, z + dz], [x - 2.05, 7.2, z + dz], 0.07, 0x5e3a22)
  for (let y = 0.4; y < 7; y += 0.45)
    beam(g, [x - 2.05, y, z - 0.25], [x - 2.05, y, z + 0.25], 0.05, 0x6b4026)
}

/** A tall faceted rock: `tiers` banded tiers on a polygon `ru` by `rn` m along the axes `u` and its normal. */
function crag(
  rnd: () => number,
  x: number,
  z: number,
  ru: number,
  rn: number,
  height: number,
  tiers: number,
  u: readonly [number, number] = [1, 0],
): void {
  const n = [-u[1], u[0]] as const,
    stack: Tier[] = []
  let y = 0
  for (let t = 0; t < tiers; t++) {
    const shrink = 1 - t * 0.12,
      sides = 6 + Math.floor(rnd() * 2),
      h = (height / tiers) * (0.85 + rnd() * 0.3)
    const ring = Array.from({ length: sides }, (_, i) => {
      const a = (-i / sides) * Math.PI * 2,
        pu = Math.cos(a) * ru * shrink * (0.85 + rnd() * 0.25),
        pn = Math.sin(a) * rn * shrink * (0.85 + rnd() * 0.25)
      return [x + pu * u[0] + pn * n[0], z + pu * u[1] + pn * n[1]] as const
    })
    const band = BANDS[(t * 2 + Math.floor(rnd() * 2)) % BANDS.length]!,
      base = wound(ring)
    shell.prism(base, y, y + h, band, 0xc9794a)
    stack.push({ ring: base, y0: y, y1: y + h, band })
    y += h
  }
  cliff(stack)
}

/** Camp 2's ledge (LF2-2): a two-tier stepped mesa, flat on top at 6 m, a plank barricade along its
 *  lip, a ladder up its west face (dressing), and a walkable stair of rock steps up its south flank. */
function ledge(rnd: () => number): void {
  const L = LEDGE
  // The west and north faces get facets; the south (stair) and east sides stay straight.
  const tier = (west: number, north: number): (readonly [number, number])[] => {
    const ring: (readonly [number, number])[] = [
      [L.x1, L.z0],
      [west, L.z0],
    ]
    for (let k = 1; k < 4; k++)
      ring.push([west - 0.15 - rnd() * 0.35, L.z0 + ((north - L.z0) * k) / 4])
    ring.push([west, north])
    for (let k = 1; k < 4; k++)
      ring.push([west + ((L.x1 - west) * k) / 4, north - 0.15 - rnd() * 0.35])
    ring.push([L.x1, north])
    return wound(ring)
  }
  world.prism(tier(L.x0, L.z1), 0, L.step, 0xb9553a, 0xc9794a)
  world.prism(
    tier(L.x0 + L.setback, L.z1 + L.setback),
    L.step,
    L.top,
    0xd98a52,
    0xc98a5a,
  )
  // The stair: one stepped block, `rise` up per `run` east, each step its tread, riser and outer side
  // (the inner side shows only off the ledge's face).
  const [zs, zn] = L.stairZ
  for (let i = 1; i <= L.steps; i++) {
    const x0 = L.stairX + (i - 1) * L.run,
      x1 = x0 + L.run,
      y0 = (i - 1) * L.rise,
      y1 = i * L.rise,
      hex = i % 2 === 0 ? 0xa86a52 : 0x9a5a44,
      mid: V3 = [(x0 + x1) / 2, y1 / 2, (zs + zn) / 2]
    outQuad(
      world,
      [x0, y1, zs],
      [x1, y1, zs],
      [x1, y1, zn],
      [x0, y1, zn],
      [mid[0], y0, mid[2]],
      0xc08a62,
    )
    outQuad(
      world,
      [x0, y0, zs],
      [x0, y1, zs],
      [x0, y1, zn],
      [x0, y0, zn],
      mid,
      hex,
    )
    outQuad(
      world,
      [x0, 0, zs],
      [x1, 0, zs],
      [x1, y1, zs],
      [x0, y1, zs],
      mid,
      hex,
    )
    if (x0 < L.x0)
      outQuad(
        world,
        [x0, 0, zn],
        [x1, 0, zn],
        [x1, y1, zn],
        [x0, y1, zn],
        mid,
        hex,
      )
  }
  const end = L.stairX + L.steps * L.run,
    high = L.steps * L.rise
  outQuad(
    world,
    [end, 0, zs],
    [end, high, zs],
    [end, high, zn],
    [end, 0, zn],
    [end - 1, high / 2, (zs + zn) / 2],
    0x9a5a44,
  )
  // The barricade: planks along the west lip, open at the south end where the stair arrives.
  const lip = L.x0 + L.setback + 0.45,
    y = L.top,
    south = L.z0 - 1.2,
    north = L.z1 + L.setback + 0.6
  for (let z = south, k = 0; z > north; z -= 0.75, k++)
    world.box(
      [lip, y, z - 0.36],
      [0.12, 1.05 + rnd() * 0.25, 0.69],
      k % 2 === 0 ? 0x7a4a2b : 0x6b4026,
    )
  for (const h of [0.35, 0.85])
    beam(
      world,
      [lip + 0.12, y + h, south + 0.1],
      [lip + 0.12, y + h, north - 0.1],
      0.12,
      0x5e3a22,
    )
  // The ladder: dressing on the west face's south end, leaning on both tiers.
  const lz = L.z0 - 2.5,
    foot = L.x0 - 1.1,
    head = L.x0 + L.setback - 0.06
  for (const dz of [-0.28, 0.28])
    beam(
      world,
      [foot, 0, lz + dz],
      [head, L.top + 0.3, lz + dz],
      0.09,
      0x6b4026,
    )
  for (let yr = 0.4; yr < L.top; yr += 0.55) {
    const xr = foot + ((head - foot) * yr) / (L.top + 0.3)
    beam(
      world,
      [xr + 0.05, yr, lz - 0.3],
      [xr + 0.05, yr, lz + 0.3],
      0.06,
      0x7a4a2b,
    )
  }
}

/** Camp 3's side canyon (LF2-2): two walls of tall rocks along the axis from the gate and a cap at the
 *  far end, so the slot opens only toward the gate and the camp inside looks straight down it. */
function sideCanyon(rnd: () => number): void {
  const { gate, u, half, from, to } = SIDE,
    n = [-u[1], u[0]] as const
  const at = (s: number, o: number): [number, number] => [
    gate[0] + u[0] * s + n[0] * o,
    gate[1] + u[1] * s + n[1] * o,
  ]
  for (let k = 0; k <= 3; k++) {
    const s = from + ((to - from) * k) / 3
    for (const side of [1, -1]) {
      const [x, z] = at(s, side * half)
      if (side === 1 || k > 0) crag(rnd, x, z, 3, 1.7, 9 + rnd() * 4, 2, u)
    }
  }
  for (const o of [-4, 0, 4]) {
    const [x, z] = at(to + 1.6, o)
    crag(rnd, x, z, 1.8, 2.6, 10 + rnd() * 3, 2, u)
  }
}

/** The sand pit (LF2-2): a pale sand floor with darker rings round the `wyrm` empty, ringed by tall
 *  faceted rocks with one gap, the mouth, toward the gate. */
function sandPit(rnd: () => number): void {
  const [cx, cz] = PIT.at,
    sides = 20
  const disc = (r0: number, r1: number, y: number, hex: Hex): void => {
    const p = (r: number, a: number): V3 => [
      cx + Math.cos(a) * r,
      y,
      cz + Math.sin(a) * r,
    ]
    for (let i = 0; i < sides; i++) {
      const a0 = (-i / sides) * Math.PI * 2,
        a1 = (-(i + 1) / sides) * Math.PI * 2
      if (r0 === 0) world.tri([cx, y, cz], p(r1, a0), p(r1, a1), hex)
      else world.quad(p(r0, a0), p(r1, a0), p(r1, a1), p(r0, a1), hex)
    }
  }
  disc(0, PIT.floor, 0.03, 0xe6b07a)
  disc(3.2, 3.9, 0.035, 0xd29462)
  disc(6.6, 7.4, 0.035, 0xd29462)
  // The ring: angle 0 points at the gate (+z); the mouth is the gap either side of it.
  const first = ((PIT.mouth + 21) * Math.PI) / 180,
    count = 12
  for (let k = 0; k < count; k++) {
    const a = first + ((Math.PI * 2 - 2 * first) * k) / (count - 1)
    crag(
      rnd,
      cx + Math.sin(a) * PIT.ring,
      cz + Math.cos(a) * PIT.ring,
      5.2,
      3.6,
      16 + rnd() * 6,
      2,
      [Math.cos(a), -Math.sin(a)],
    )
  }
}

/** The signpost's foot, on the trail's east edge where the branch to the ledge's stair leaves it. */
export const SIGNPOST = [0.8, -20.5] as const

/** The CAMPS / GATE signpost at the fork (LF2-2), and the paler branch from it to the ledge's stair. */
function signpost(): void {
  const [x, z] = SIGNPOST
  world.box([x, 0, z], [0.16, 2.6, 0.16], 0x5e3a22)
  // Arrow boards: a footprint with a point, raised to a board's height.
  const arrow = (y: number, dir: readonly [number, number], hex: Hex): void => {
    const p = [-dir[1], dir[0]] as const,
      len = 1.3,
      t = 0.05
    const pt = (a: number, b: number): readonly [number, number] => [
      x + dir[0] * a + p[0] * b,
      z + dir[1] * a + p[1] * b,
    ]
    world.prism(
      wound([
        pt(0.05, -t),
        pt(len - 0.25, -t),
        pt(len, 0),
        pt(len - 0.25, t),
        pt(0.05, t),
      ]),
      y,
      y + 0.3,
      hex,
      0x6b4026,
    )
  }
  arrow(2, [0, -1], 0xc9a26a) // GATE, down the canyon
  arrow(1.55, [0.8, -0.6], 0xb88e58) // CAMPS, toward the ledge
  // The branch: a strip from the post to the stair's foot, its sides across the branch, facing up.
  const sx = LEDGE.stairX - 0.6,
    sz = (LEDGE.stairZ[0] + LEDGE.stairZ[1]) / 2,
    len = Math.hypot(sx - x, sz - z),
    px = -(sz - z) / len,
    pz = (sx - x) / len
  outQuad(
    world,
    [x - px * 0.5, 0.021, z - pz * 0.5],
    [x + px * 0.5, 0.021, z + pz * 0.5],
    [sx + px * 1.1, 0.021, sz + pz * 1.1],
    [sx - px * 1.1, 0.021, sz - pz * 1.1],
    [(x + sx) / 2, -1, (z + sz) / 2],
    0xe8b886,
  )
}

/** LF2-2's layout pass: the ledge, the side canyon, the sand pit and the signpost, on their own generator. */
function layout(): void {
  const rnd = lcg(2202)
  ledge(rnd)
  sideCanyon(rnd)
  sandPit(rnd)
  signpost()
}

/** One tier of a mesa or crag: its footprint ring (wound for `prism`), its floor and top, its band colour. */
interface Tier {
  readonly ring: readonly (readonly [number, number])[]
  readonly y0: number
  readonly y1: number
  readonly band: Hex
}

/** LF2-4's own fixed-seed generator for the cliffs and the ground's dressing, so neither moves BM-1's or LF2-2's
 *  layout (which draw `rand` and `lcg(2202)`). Reset by `buildCanyon`. */
let rk = lcg(2404)

/** `hex` with each channel scaled by `1 + f` (f a fixed-seed jitter of up to `amount`), a little warmer or cooler. */
function vary(hex: Hex, amount: number): Hex {
  const f = 1 + (rk() * 2 - 1) * amount,
    warm = (rk() * 2 - 1) * amount * 0.35
  const ch = (shift: number, k: number): number =>
    Math.max(0, Math.min(255, Math.round(((hex >> shift) & 255) * k)))
  return (ch(16, f + warm) << 16) | (ch(8, f) << 8) | ch(0, f - warm)
}

/** `a` blended `t` of the way to `b`, per channel in sRGB. */
function mix(a: Hex, b: Hex, t: number): Hex {
  const ch = (shift: number): number =>
    Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t)
  return (ch(16) << 16) | (ch(8) << 8) | ch(0)
}

/** A triangle turned to face away from `centre`. */
function outTri(g: Geo, a: V3, b: V3, c: V3, centre: V3, hex: Hex): void {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
    w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  const n = [
    u[1]! * w[2]! - u[2]! * w[1]!,
    u[2]! * w[0]! - u[0]! * w[2]!,
    u[0]! * w[1]! - u[1]! * w[0]!,
  ]
  const out = [0, 1, 2].map(k => (a[k]! + b[k]! + c[k]!) / 3 - centre[k]!)
  if (n[0]! * out[0]! + n[1]! * out[1]! + n[2]! * out[2]! >= 0)
    g.tri(a, b, c, hex)
  else g.tri(a, c, b, hex)
}

/** The cream of the mesas' lit tops, and the paler lip under it (the targets' caps). */
const CREAM = 0xf2d8a8,
  CREAM_LIP = 0xe6bf88

/** LF2-4: a mesa's tiers as a faceted cliff into `rock`: each tier's wall in two rows of facets (the middle ring
 *  pushed in or out a little), a chamfered lip, some tiers with an overhanging cornice, a lit cap (cream on the
 *  top tier), every face its band colour jittered on a fixed seed, and scree boulders at the foot. The base ring
 *  is the plain prism's, so the cliff stands on the same footprint as the shell the far stand-in is welded from. */
function cliff(tiers: readonly Tier[]): void {
  for (const [k, tier] of tiers.entries()) {
    const { y0, y1, band } = tier,
      top = k === tiers.length - 1
    // Long faces split in two at a point set a little in, so a wall reads as columns of facets, not one slab.
    const ring: (readonly [number, number])[] = []
    for (const [i, p] of tier.ring.entries()) {
      const q = tier.ring[(i + 1) % tier.ring.length]!
      ring.push(p)
      if (Math.hypot(q[0] - p[0], q[1] - p[1]) > 7) {
        const t = 0.4 + rk() * 0.2
        ring.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t])
      }
    }
    const n = ring.length
    const rock = tiers[0]!.ring[0]![0] < 0 ? rockWest : rockEast
    const cx = ring.reduce((sum, p) => sum + p[0], 0) / n,
      cz = ring.reduce((sum, p) => sum + p[1], 0) / n,
      rad =
        ring.reduce((sum, p) => sum + Math.hypot(p[0] - cx, p[1] - cz), 0) / n
    const h = y1 - y0,
      lip = Math.min(0.7, Math.max(0.25, h * 0.12), rad * 0.12),
      over = k > 0 && h > 2.5 && rk() < (top ? 0.6 : 0.3),
      cornice = over ? Math.min(0.5, h * 0.12) : 0,
      yb = y1 - lip,
      yc = yb - cornice,
      ym = y0 + (yc - y0) * (0.4 + rk() * 0.2)
    const scaled = (
      p: readonly [number, number],
      s: number,
    ): readonly [number, number] => [cx + (p[0] - cx) * s, cz + (p[1] - cz) * s]
    const mid: (readonly [number, number])[] = [],
      out: (readonly [number, number])[] = []
    for (const p of ring) mid.push(scaled(p, 0.96 + rk() * 0.07))
    for (const p of ring) out.push(scaled(p, over ? 1.05 + rk() * 0.03 : 1))
    const inner = ring.map(p => scaled(p, 1 - lip / rad)),
      centre: V3 = [cx, (y0 + y1) / 2, cz],
      lower = top ? mix(band, CREAM_LIP, 0.2) : band,
      // The upper row takes a neighbouring band, so each tier reads as two strata, as the targets' walls do.
      upper = top
        ? mix(band, CREAM_LIP, 0.55)
        : mix(band, BANDS[(BANDS.indexOf(band) + 2) % BANDS.length]!, 0.75),
      lipHex = top ? CREAM_LIP : mix(band, CREAM, 0.25),
      capHex = top ? CREAM : mix(band, CREAM, 0.4)
    const at = (p: readonly [number, number], y: number): V3 => [p[0], y, p[1]]
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      outQuad(
        rock,
        at(ring[i]!, y0),
        at(ring[j]!, y0),
        at(mid[j]!, ym),
        at(mid[i]!, ym),
        centre,
        vary(lower, 0.12),
      )
      outQuad(
        rock,
        at(mid[i]!, ym),
        at(mid[j]!, ym),
        at(ring[j]!, yc),
        at(ring[i]!, yc),
        centre,
        vary(upper, 0.12),
      )
      if (over) {
        outQuad(
          rock,
          at(ring[i]!, yc),
          at(ring[j]!, yc),
          at(out[j]!, yc),
          at(out[i]!, yc),
          [cx, yc + 20, cz],
          vary(mix(band, 0x5a2a20, 0.3), 0.06),
        )
        outQuad(
          rock,
          at(out[i]!, yc),
          at(out[j]!, yc),
          at(out[j]!, yb),
          at(out[i]!, yb),
          centre,
          vary(upper, 0.08),
        )
      }
      outQuad(
        rock,
        at(out[i]!, yb),
        at(out[j]!, yb),
        at(inner[j]!, y1),
        at(inner[i]!, y1),
        [cx, yb - 20, cz],
        vary(lipHex, 0.06),
      )
      outTri(
        rock,
        [cx, y1, cz],
        at(inner[i]!, y1),
        at(inner[j]!, y1),
        [cx, y1 - 20, cz],
        vary(capHex, 0.05),
      )
    }
    if (k === 0) scree(rock, ring, cx, cz)
  }
}

const SCREE: readonly Hex[] = [0x9a5238, 0xb0603f, 0x8a4630, 0xc0754a]

/** Scree boulders along a cliff's foot, out from its base ring, kept off the routes, the camps and the pit. */
function scree(
  rock: Geo,
  ring: readonly (readonly [number, number])[],
  cx: number,
  cz: number,
): void {
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!,
      q = ring[(i + 1) % ring.length]!
    for (let m = 0; m < 2; m++) {
      if (rk() > 0.5) continue
      const t = rk(),
        x0 = p[0] + (q[0] - p[0]) * t,
        z0 = p[1] + (q[1] - p[1]) * t,
        len = Math.hypot(x0 - cx, z0 - cz) || 1,
        d = 0.2 + rk() * 1.6,
        x = x0 + ((x0 - cx) / len) * d,
        z = z0 + ((z0 - cz) / len) * d,
        r = 0.35 + rk() * 0.85,
        h = r * (0.6 + rk() * 0.5)
      if (
        !clearOf(x, z, r) ||
        Math.hypot(x - PIT.at[0], z - PIT.at[1]) < PIT.ring + 5
      )
        continue
      stone(rock, x, z, r, h, SCREE)
    }
  }
}

/** A faceted rock: a jittered base ring sunk a little, a narrower shoulder ring and an off-centre apex. */
function stone(
  g: Geo,
  x: number,
  z: number,
  r: number,
  h: number,
  hexes: readonly Hex[],
): void {
  const sides = 6 + Math.floor(rk() * 2),
    turn = rk() * Math.PI
  const base: V3[] = [],
    mid: V3[] = []
  for (let i = 0; i < sides; i++) {
    const a = turn - (i / sides) * Math.PI * 2,
      rb = r * (0.85 + rk() * 0.3),
      rm = r * (0.55 + rk() * 0.3)
    base.push([x + Math.cos(a) * rb, -0.05, z + Math.sin(a) * rb])
    mid.push([
      x + Math.cos(a) * rm,
      h * (0.45 + rk() * 0.25),
      z + Math.sin(a) * rm,
    ])
  }
  const apex: V3 = [x + (rk() - 0.5) * r * 0.4, h, z + (rk() - 0.5) * r * 0.4],
    centre: V3 = [x, h * 0.3, z],
    hex = hexes[Math.floor(rk() * hexes.length)]!
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides
    outQuad(g, base[i]!, base[j]!, mid[j]!, mid[i]!, centre, vary(hex, 0.1))
    outTri(g, mid[i]!, mid[j]!, apex, centre, vary(mix(hex, CREAM, 0.12), 0.08))
  }
}

/** The ways a player walks (LF2-4): to camp 1, the branch to the ledge's stair, to camp 3 and through the gate
 *  into the pit. Dressing and scree keep off them, so nothing taller than a step stands where a player walks. */
export const ROUTES: readonly (readonly (readonly [number, number])[])[] = [
  [
    [1.5, -4],
    [0, -10],
    [-2, -18],
    [-7, -23],
    [-11, -25],
    [-14, -28],
  ],
  [
    [-2, -22],
    [3.2, -25.8],
    [16.9, -25.8],
  ],
  [
    [0.8, -20.5],
    [3.4, -25.8],
  ],
  [
    [3.2, -25.8],
    [0, -40],
    [2, -52],
    [6.5, -57.5],
    [9.5, -55.6],
    [13.5, -52.5],
    [18.4, -50.5],
  ],
  [
    [9.5, -55.6],
    [5, -57.5],
    [2, -60],
    [2, -70],
    [2, -84],
    [2, -100],
  ],
]

/** The distance from (x, z) to the segment a to b. */
function toSegment(
  x: number,
  z: number,
  a: readonly [number, number],
  b: readonly [number, number],
): number {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    t = Math.max(
      0,
      Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)),
    )
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t)
}

/** The distance from (x, z) to the nearest route. */
function toRoute(x: number, z: number): number {
  let best = Infinity
  for (const route of ROUTES)
    for (let i = 0; i + 1 < route.length; i++)
      best = Math.min(best, toSegment(x, z, route[i]!, route[i + 1]!))
  return best
}

/** Whether a rock of radius r at (x, z) leaves the walk clear: off the routes and the trail, away from the camps,
 *  the target posts, the depot, the ledge and its stair, the gate and the pit's floor. */
function clearOf(x: number, z: number, r: number): boolean {
  if (toRoute(x, z) < 1.4 + r) return false
  if (z > -66 && z < 4 && Math.abs(x - trailX(z)) < 2 + r) return false
  if (CAMPS.some(([, c]) => Math.hypot(x - c[0], z - c[2]) < 7 + r))
    return false
  if (
    Math.hypot(x - 2.5, z + 10) < 2.5 + r ||
    Math.hypot(x + 3.5, z + 14) < 2.5 + r
  )
    return false
  if (x > -10.5 - r && x < 1.6 + r && z > -4.5 - r && z < 8 + r) return false
  if (
    x > LEDGE.stairX - 0.8 - r &&
    x < LEDGE.x1 + 0.8 + r &&
    z > LEDGE.z1 - 0.8 - r &&
    z < LEDGE.stairZ[0] + 0.8 + r
  )
    return false
  if (Math.abs(z + 62) < 3 + r && x > -7 && x < 11) return false
  return Math.hypot(x - PIT.at[0], z - PIT.at[1]) > PIT.floor + 1 + r
}

const PATCHES: readonly Hex[] = [
  0xc98552, 0xcf8a55, 0xbf7a4a, 0xc47e4e, 0xd38f5a, 0xb86e44,
]
const PEBBLES: readonly Hex[] = [0xb5704a, 0xa0603f, 0xc98458, 0x8f5238]
const STRAW: readonly Hex[] = [0xc9ac5e, 0xb39548, 0xd8bd72, 0x9c8a46]

/** A flat ring of `sides` points round (x, z), r jittered, at height y, fanned and facing up. */
function patch(x: number, z: number, r: number, y: number, hex: Hex): void {
  const sides = 6 + Math.floor(rk() * 3),
    turn = rk() * Math.PI
  const pts: V3[] = Array.from({ length: sides }, (_, i) => {
    const a = turn - (i / sides) * Math.PI * 2,
      rr = r * (0.65 + rk() * 0.45)
    return [x + Math.cos(a) * rr, y, z + Math.sin(a) * rr]
  })
  for (let i = 0; i < sides; i++)
    outTri(
      dress,
      [x, y, z],
      pts[i]!,
      pts[(i + 1) % sides]!,
      [x, y - 10, z],
      vary(hex, 0.05),
    )
}

/** A dry-grass tuft: `blades` thin blades leaning out from (x, z), each a double-sided triangle. */
function tuft(x: number, z: number, tall: number): void {
  const blades = 5 + Math.floor(rk() * 3),
    hex = STRAW[Math.floor(rk() * STRAW.length)]!
  for (let i = 0; i < blades; i++) {
    const a = rk() * Math.PI * 2,
      ox = Math.cos(a) * 0.06,
      oz = Math.sin(a) * 0.06,
      lean = 0.08 + rk() * 0.14,
      h = tall * (0.6 + rk() * 0.4),
      w = 0.035,
      across = [-Math.sin(a) * w, Math.cos(a) * w]
    const b0: V3 = [x + ox - across[0]!, 0, z + oz - across[1]!],
      b1: V3 = [x + ox + across[0]!, 0, z + oz + across[1]!],
      tip: V3 = [x + ox + Math.cos(a) * lean, h, z + oz + Math.sin(a) * lean],
      c = vary(hex, 0.1)
    dress.tri(b0, b1, tip, c)
    dress.tri(b1, b0, tip, c)
  }
}

/** A strip along the trail at offsets o0 to o1 m from its centre, between z0 and z1, in pieces of `piece` m. */
function trailStrip(
  o0: number,
  o1: number,
  z0: number,
  z1: number,
  y: number,
  hex: Hex,
  piece: number,
): void {
  // The path quads run straight between the trail's 4 m points, so the strip follows the same straight lines.
  const along = (z: number): number => {
    const za = Math.ceil(z / 4) * 4,
      zb = za - 4,
      t = (za - z) / 4
    return trailX(za) + (trailX(zb) - trailX(za)) * t
  }
  for (let z = z0; z > z1 + 1e-6; z -= piece) {
    const zn = Math.max(z - piece, z1),
      a = along(z),
      b = along(zn)
    outQuad(
      dress,
      [a + o0, y, z],
      [a + o1, y, z],
      [b + o1, y, zn],
      [b + o0, y, zn],
      [a, y - 10, z],
      vary(hex, 0.07),
    )
  }
}

/** LF2-4's ground: colour patches over the walkway, the trail's edges, wheel ruts to the gate, a faceted rock
 *  every 2 to 4 m along the trail, bigger rocks set back from it, and dry-grass tufts. All of it is `dress`, which
 *  the bake draws in the L0 tiles only; nothing a player walks over stands taller than a step (0.25 m). */
/** Whether a ground patch of radius r at (x, z) shows: off the trail, the pit's floor and the depot's footing. */
const patchShows = (x: number, z: number, r: number): boolean =>
  !(z > -66 && z < 4 && Math.abs(x - trailX(z)) < 1.7 + r) &&
  Math.hypot(x - PIT.at[0], z - PIT.at[1]) >= PIT.floor + r &&
  !(x > -10 && x < 1.5 && z > -4 && z < 7.5)

/** Colour patches on a jittered 6 m grid, each smaller than half the spacing so no two overlap. */
function patches(): void {
  for (let x = -24; x <= 24; x += 6)
    for (let z = 26; z >= -92; z -= 6) {
      const px = x + (rk() - 0.5) * 1.6,
        pz = z + (rk() - 0.5) * 1.6,
        r = 1.1 + rk() * 0.9,
        hex = PATCHES[Math.floor(rk() * PATCHES.length)]!
      if (rk() <= 0.75 && patchShows(px, pz, r)) patch(px, pz, r, 0.008, hex)
    }
}

function dressing(): void {
  rk = lcg(2405)
  patches()
  // The path's edges: a darker band each side, broken into pieces of their own shade.
  trailStrip(-1.95, -1.6, 0, -64, 0.023, 0xc07c4c, 1.6)
  trailStrip(1.6, 1.95, 0, -64, 0.023, 0xc07c4c, 1.6)
  // Wheel ruts from the fork to the gate.
  for (const o of [-0.72, 0.56])
    trailStrip(o, o + 0.17, -20, -64, 0.025, 0xb87246, 2)
  // A faceted rock every 2 to 4 m along the trail, alternating sides, low enough to step over.
  let side = 1
  for (let z = -2.5; z > -62; z -= 2 + rk() * 2) {
    const o = side * (1.9 + rk() * 0.7),
      x = trailX(z) + o,
      r = 0.16 + rk() * 0.2
    side = -side
    if (toRoute(x, z) < 0.9 + r || Math.hypot(x - 0.8, z + 20.5) < 1.2) continue
    stone(dress, x, z, r, Math.min(0.24, r * (0.7 + rk() * 0.5)), PEBBLES)
  }
  // Bigger rocks set back from the trail, and the tufts.
  for (let k = 0; k < 70; k++) {
    const z = 4 - rk() * 70,
      x = trailX(z) + (rk() < 0.5 ? -1 : 1) * (3.2 + rk() * 14),
      r = 0.3 + rk() * 0.45
    if (!clearOf(x, z, r)) continue
    stone(dress, x, z, r, r * (0.6 + rk() * 0.5), PEBBLES)
  }
  for (let k = 0; k < 220; k++) {
    const z = 20 - rk() * 108,
      edge = rk() < 0.35,
      x = edge
        ? trailX(z) + (rk() < 0.5 ? -1 : 1) * (2 + rk() * 0.6)
        : (rk() * 2 - 1) * 23
    if (edge ? toRoute(x, z) < 1 || z < -64 : !clearOf(x, z, 0.3)) continue
    tuft(x, z, 0.26 + rk() * 0.16)
  }
}

function scene(): void {
  ground()
  depot()
  gate()
  waterTower(15, -20)
  railway()
  for (const [i, [, [x, y, z]]] of CAMPS.entries()) {
    camp(x, y, z)
    campDetail(i, x, y, z)
  }
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
      true,
    )
    mesa(
      38 + jitter(4),
      z - 8 + jitter(4),
      12 + rand() * 6,
      12 + rand() * 4,
      12 + rand() * 12,
      5,
      true,
    )
  }
  mesa(-14, -60, 9, 6, 9, 3, true)
  mesa(19, -64, 9, 6, 10, 3, true)
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
  layout()
  dressing()
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

const MESA = {
  name: 'Mesa',
  pbrMetallicRoughness: {
    baseColorFactor: [1, 1, 1, 1],
    metallicFactor: 0,
    roughnessFactor: 1,
  },
}
/** LF2-7: the second surface material, pbr and vertex-coloured at mid metalness; look's `metal` row sets it. */
const METAL = {
  name: 'Metal',
  pbrMetallicRoughness: {
    baseColorFactor: [1, 1, 1, 1],
    metallicFactor: 0.5,
    roughnessFactor: 0.45,
  },
}
const SKY = {
  name: 'Sky',
  doubleSided: true,
  pbrMetallicRoughness: {
    baseColorFactor: [1, 1, 1, 1],
    metallicFactor: 0,
    roughnessFactor: 1,
  },
  extensions: { KHR_materials_unlit: {} },
}
const GLOW = {
  name: 'Glow',
  pbrMetallicRoughness: {
    baseColorFactor: [1, 1, 1, 1],
    metallicFactor: 0,
    roughnessFactor: 1,
  },
  extensions: { KHR_materials_unlit: {} },
}

/** The bake's sand skirt: flat ground from the 216 m rim out to the 250 m edge, so the edge sampler finds ground. */
function skirt(): void {
  const rim = 216,
    edge = 250,
    hex = 0xea9553
  world.quad(
    [-edge, 0, -edge],
    [-edge, 0, edge],
    [-rim, 0, edge],
    [-rim, 0, -edge],
    hex,
  )
  world.quad(
    [rim, 0, -edge],
    [rim, 0, edge],
    [edge, 0, edge],
    [edge, 0, -edge],
    hex,
  )
  world.quad(
    [-rim, 0, -edge],
    [-rim, 0, -rim],
    [rim, 0, -rim],
    [rim, 0, -edge],
    hex,
  )
  world.quad(
    [-rim, 0, rim],
    [-rim, 0, edge],
    [rim, 0, edge],
    [rim, 0, rim],
    hex,
  )
}

/** A welded copy of `g`: shared vertices with averaged normals, so the far proxy can simplify a flat-shaded mesh. */
function welded(g: Geo): {
  pos: number[]
  nor: number[]
  col: number[]
  index: number[]
} {
  const at = new Map<string, number>(),
    out = {
      pos: [] as number[],
      nor: [] as number[],
      col: [] as number[],
      index: [] as number[],
    }
  for (let v = 0; v < g.pos.length / 3; v++) {
    const p = [g.pos[v * 3]!, g.pos[v * 3 + 1]!, g.pos[v * 3 + 2]!],
      key = p.map(n => n.toFixed(3)).join(',')
    let i = at.get(key)
    if (i === undefined) {
      i = out.pos.length / 3
      at.set(key, i)
      out.pos.push(...p)
      out.nor.push(0, 0, 0)
      out.col.push(g.col[v * 4]!, g.col[v * 4 + 1]!, g.col[v * 4 + 2]!, 255)
    }
    for (let k = 0; k < 3; k++) out.nor[i * 3 + k]! += g.nor[v * 3 + k]!
    out.index.push(i)
  }
  for (let i = 0; i < out.nor.length; i += 3) {
    const len = Math.hypot(out.nor[i]!, out.nor[i + 1]!, out.nor[i + 2]!) || 1
    for (let k = 0; k < 3; k++) out.nor[i + k]! /= len
    if (out.nor[i] === 0 && out.nor[i + 1] === 0 && out.nor[i + 2] === 0)
      out.nor[i + 1] = 1
  }
  return out
}

/** One mesh for `glb`: a name, its geometry, its material index, and an index list if it is welded. */
interface MeshIn {
  readonly name: string
  readonly g: Pick<Geo, 'pos' | 'nor' | 'col'>
  readonly material: number
  readonly index?: readonly number[]
  /** LF2-7: a second primitive in another material (the metal), left out when empty. */
  readonly extra?: {
    readonly g: Pick<Geo, 'pos' | 'nor' | 'col'>
    readonly material: number
  }
}

/** Writes a GLB of `meshes` (one node each) and the named empties `marks`; the same input, the same bytes. */
function glb(
  meshes: readonly MeshIn[],
  marks: readonly (readonly [string, V3])[],
  materials: readonly object[],
  unlit: boolean,
  generator: string,
  scene: string,
): Buffer {
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
  const primitive = ({
    g,
    material,
    index,
  }: Pick<MeshIn, 'g' | 'material' | 'index'>): object => {
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
      accessors.push({
        bufferView: view,
        componentType,
        count,
        type,
        ...extra,
      })
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
    const indices =
      index === undefined
        ? {}
        : {
            indices: (() => {
              const view = push(
                Buffer.from(new Uint32Array(index).buffer),
                34963,
              )
              accessors.push({
                bufferView: view,
                componentType: 5125,
                count: index.length,
                type: 'SCALAR',
              })
              return accessors.length - 1
            })(),
          }
    return {
      attributes: { POSITION: position, NORMAL: normal, COLOR_0: colour },
      ...indices,
      material,
    }
  }
  const gltfMeshes = meshes.map(mesh => ({
    name: mesh.name,
    primitives: [
      ...(mesh.extra === undefined || mesh.g.pos.length > 0
        ? [primitive(mesh)]
        : []),
      ...(mesh.extra !== undefined && mesh.extra.g.pos.length > 0
        ? [primitive(mesh.extra)]
        : []),
    ],
  }))
  const nodes = [
    ...gltfMeshes.map(({ name }, mesh) => ({ name, mesh })),
    ...marks.map(([name, translation]) => ({ name, translation })),
  ]
  const bin = Buffer.concat(chunks)
  const json = {
    asset: { version: '2.0', generator },
    ...(unlit ? { extensionsUsed: ['KHR_materials_unlit'] } : {}),
    scene: 0,
    scenes: [{ name: scene, nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes: gltfMeshes,
    materials,
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

/** Appends `from`'s triangles to `to`. */
function merge(to: Geo, from: Geo): void {
  // A loop, not a spread: the cliffs hold more values than a call takes arguments.
  for (const v of from.pos) to.pos.push(v)
  for (const v of from.nor) to.nor.push(v)
  for (const v of from.col) to.col.push(v)
  for (const v of from.mat) to.mat.push(v)
}

/** LF2-7: draws `draw`'s triangles in the `metal` material (tin, rails, iron straps, the bells, the tower's cap and
 *  hoops). Brass and tin differ only in vertex colour; everything else stays `mesa`. */
function metal(draw: () => void): void {
  metalOn = true
  try {
    draw()
  } finally {
    metalOn = false
  }
}

/** `g`'s triangles flagged `flag` (0 mesa, 1 metal), in order. */
function part(g: Geo, flag: number): Geo {
  const out = new Geo()
  for (const [t, f] of g.mat.entries()) {
    if (f !== flag) continue
    for (let i = t * 9; i < t * 9 + 9; i++) out.pos.push(g.pos[i]!)
    for (let i = t * 9; i < t * 9 + 9; i++) out.nor.push(g.nor[i]!)
    for (let i = t * 12; i < t * 12 + 12; i++) out.col.push(g.col[i]!)
    out.mat.push(flag)
  }
  return out
}

/** Builds the level GLB from scratch; every call returns the same bytes. `bake` writes the
 *  bake's input instead (BM-2's three author-side changes, now in source): no sky dome (the
 *  sunset is `look` keys), the sand skirt to the 250 m edge, and a welded far stand-in `far.canyon`.
 *  LF2-5: the depot's detail ships in its own source GLB (`buildDepot`, depot.glb), which keeps
 *  canyon.glb under the repo's 1 MiB file limit; the bake input folds it into the canyon and glow
 *  meshes after the far stand-in is welded, so the far mesh keeps only the depot's shell. */
export function buildCanyon(options: { readonly bake?: boolean } = {}): Buffer {
  const bake = options.bake === true
  seed = SEED
  world = new Geo()
  sky = new Geo()
  glow = new Geo()
  door = new Geo()
  hero = new Geo()
  heroGlow = new Geo()
  rackRifle = new Geo()
  shell = new Geo()
  rockWest = new Geo()
  rockEast = new Geo()
  dress = new Geo()
  props = new Geo()
  propsGlow = new Geo()
  plainGlow = new Geo()
  rk = lcg(2404)
  rc = lcg(2606)
  scene()
  if (bake) {
    depotDetail()
    skirt()
  } else skyDome()
  // LF2-4: the far stand-in is welded from the plain shell. The bake draws the faceted cliffs and the ground's
  // dressing in the L0 tiles only (`dress`, which also collides), and the plain shell in the L1 tiles only
  // (`coarse.mesas`, which never collides), so the coarse tiles and their near view keep BM-1's weight.
  const solid = new Geo()
  merge(solid, world)
  merge(solid, shell)
  const far = bake ? welded(solid) : undefined
  const detail = new Geo()
  if (bake) {
    merge(world, hero)
    merge(glow, heroGlow)
    merge(detail, rockWest)
    merge(detail, rockEast)
    merge(detail, dress)
    // LF2-6: the camps', gate's, cacti's and tower's detail joins the L0 detail, and its lit parts are an L0 detail
    // node of their own (`dress.glow`), so the L1 tiles never draw a flame without its fire (Codex MUST); the plain
    // stand-ins are in `shell` (the far stand-in and `coarse.mesas`), their flames left out of the bake.
    merge(detail, props)
  } else merge(glow, plainGlow)
  // LF2-7: the metal is a primitive of its own. The engine's L1 tiles take 2 draws, so in the bake the canyon's
  // metal (the roofs' tin, the rails, the depot's bell) is L0 detail (`dress`), and the L1 tiles draw it in `mesa`
  // (`coarse.mesas`, beside the shell's plain tower cap).
  const metalIndex = bake ? 2 : 3,
    canyonMetal = part(bake ? world : solid, 1),
    coarse = new Geo(),
    detailMetal = part(detail, 1)
  merge(coarse, shell)
  merge(coarse, canyonMetal)
  merge(detailMetal, canyonMetal)
  const meshes: MeshIn[] = [
    {
      name: 'canyon',
      g: part(bake ? world : solid, 0),
      material: 0,
      ...(bake ? {} : { extra: { g: canyonMetal, material: metalIndex } }),
    },
    ...(bake ? [] : [{ name: 'sky', g: sky, material: 1 }]),
    { name: 'glow', g: glow, material: bake ? 1 : 2 },
    {
      name: 'gate.door',
      g: part(door, 0),
      material: 0,
      extra: { g: part(door, 1), material: metalIndex },
    },
    ...(bake
      ? [
          { name: 'rack.rifle', g: rackRifle, material: 0 },
          {
            name: 'dress',
            g: part(detail, 0),
            material: 0,
            extra: { g: detailMetal, material: metalIndex },
          },
          { name: 'dress.glow', g: propsGlow, material: 1 },
          { name: 'coarse.mesas', g: coarse, material: 0 },
        ]
      : []),
    ...(far === undefined
      ? []
      : [{ name: 'far.canyon', g: far, material: 0, index: far.index }]),
  ]
  // Named empties the product rows point at (spawn, rack, targets, camps, gate, the Wyrm's pit).
  const marks: readonly (readonly [string, V3])[] = [
    ['spawn', [-1.6, 0.35, 2.6]],
    ['rack', [-2.2, 1.12, -0.92]],
    ['target.1', [2.5, 1.55, -9.88]],
    ['target.2', [-3.5, 1.55, -13.88]],
    ...CAMPS,
    [
      'ledge',
      [
        LEDGE.stairX + LEDGE.steps * LEDGE.run - 0.3,
        LEDGE.top,
        (LEDGE.stairZ[0] + LEDGE.stairZ[1]) / 2,
      ],
    ],
    ['signpost', [SIGNPOST[0], 0, SIGNPOST[1]]],
    ['gate', [2, 0, -62]],
    ['wyrm', [2, 0, -100]],
  ]
  // The bake reads no unlit extension: the sky is look keys, and glow's look entry makes it emissive.
  return glb(
    meshes,
    marks,
    bake
      ? [MESA, { ...GLOW, extensions: undefined }, METAL]
      : [MESA, SKY, GLOW, METAL],
    !bake,
    'shardfile src/tools/brasscap/canyon.ts (BM-1)',
    'brasscap-mesa',
  )
}

/** The depot's detail GLB (LF2-5), in world coordinates beside canyon.glb: tin, planks, rafters, the sign,
 *  the bench, barrels, lantern, bell, rack, crate and handcar (`depot`), the lantern's lit glass
 *  (`depot.glow`) and the rack's lever-action (`rack.rifle`). The bake input carries the first two inside its
 *  canyon and glow meshes, and the rifle as its own `rack.rifle` node, a panel. */
export function buildDepot(): Buffer {
  hero = new Geo()
  heroGlow = new Geo()
  rackRifle = new Geo()
  depotDetail()
  return glb(
    [
      {
        name: 'depot',
        g: part(hero, 0),
        material: 0,
        extra: { g: part(hero, 1), material: 2 },
      },
      { name: 'depot.glow', g: heroGlow, material: 1 },
      { name: 'rack.rifle', g: rackRifle, material: 0 },
    ],
    [],
    [MESA, GLOW, METAL],
    true,
    'shardfile src/tools/brasscap/canyon.ts (LF2-5)',
    'brasscap-depot',
  )
}

/** The terrain detail GLBs (LF2-4), in world coordinates beside canyon.glb, each under the repo's 1 MiB limit:
 *  `cliffs-west` and `cliffs-east` hold the near mesas and crags as faceted cliffs with scree (they replace
 *  canyon.glb's plain ones), `ground` the ground's dressing. The bake input carries all three as its `dress` node,
 *  drawn in the L0 tiles only, with canyon.glb's plain mesas as `coarse.mesas` in the L1 tiles. */
export const TERRAIN_PARTS = ['cliffs-west', 'cliffs-east', 'ground'] as const
export type TerrainPart = (typeof TERRAIN_PARTS)[number]
function terrainPart(part: TerrainPart): Geo {
  if (part === 'ground') return dress
  return part === 'cliffs-west' ? rockWest : rockEast
}

export function buildTerrain(part: TerrainPart): Buffer {
  buildCanyon()
  return glb(
    [{ name: part, g: terrainPart(part), material: 0 }],
    [],
    [MESA],
    true,
    'shardfile src/tools/brasscap/canyon.ts (LF2-4)',
    `brasscap-${part}`,
  )
}

/** The props detail GLB (LF2-6), in world coordinates beside canyon.glb: the camps (tents, fires, crates, barrels,
 *  flags, camp 3's wagon), the gate's frame, sign, lantern and bell post, the saguaros and the water tower (`props`),
 *  and their lit glass, tent glow and flames (`props.glow`). The bake input carries them in its `dress` and
 *  `dress.glow` nodes, both drawn in the L0 tiles only; the plain camps, cacti, tower and sign stay in canyon.glb as the far and L1 stand-ins. */
export function buildProps(): Buffer {
  buildCanyon()
  return glb(
    [
      {
        name: 'props',
        g: part(props, 0),
        material: 0,
        extra: { g: part(props, 1), material: 2 },
      },
      { name: 'props.glow', g: propsGlow, material: 1 },
    ],
    [],
    [MESA, GLOW, METAL],
    true,
    'shardfile src/tools/brasscap/canyon.ts (LF2-6)',
    'brasscap-props',
  )
}

/** The props detail, its lit parts and the plain camps' flames it replaces in the bake, for canyon.test.ts. */
export function propsGeo(): { props: Geo; glow: Geo; plainGlow: Geo } {
  buildCanyon({ bake: true })
  return { props, glow: propsGlow, plainGlow }
}

/** The gate door panel's mesh (`gate.door`), for canyon.test.ts. */
export function doorGeo(): Geo {
  buildCanyon()
  return door
}

/** The terrain detail's cliffs, ground dressing and the plain shell they stand in for, for canyon.test.ts. */
export function terrainGeo(): { rock: Geo; dress: Geo; shell: Geo } {
  buildCanyon()
  const rock = new Geo()
  merge(rock, rockWest)
  merge(rock, rockEast)
  return { rock, dress, shell }
}

/** The depot detail's solid mesh with the rack's rifle, for the checks in canyon.test.ts. */
export function depotGeo(): Geo {
  buildDepot()
  const g = new Geo()
  merge(g, hero)
  merge(g, rackRifle)
  return g
}

/** The level's world mesh (everything solid but the gate door, with the plain mesas), for the layout checks in
 *  canyon.test.ts. */
export function canyonWorld(): Geo {
  buildCanyon()
  const g = new Geo()
  merge(g, world)
  merge(g, shell)
  return g
}

if (process.argv[1] === import.meta.filename) {
  const bake = process.argv.includes('--bake'),
    out =
      process.argv.filter(arg => arg !== '--bake')[2] ??
      'corpus/sources/brasscap-mesa/canyon.glb',
    file = buildCanyon({ bake })
  writeFileSync(out, file)
  process.stdout.write(
    `${out}: ${file.length} bytes, ${(world.pos.length + shell.pos.length + sky.pos.length + glow.pos.length + door.pos.length + (bake ? rockWest.pos.length + rockEast.pos.length + dress.pos.length + rackRifle.pos.length + props.pos.length : 0)) / 9} triangles\n`,
  )
  // The level's source writes the depot's detail GLB beside it (LF2-5); the bake input carries it already.
  if (!bake) {
    const depotOut = path.join(path.dirname(out), 'depot.glb'),
      depotFile = buildDepot()
    writeFileSync(depotOut, depotFile)
    process.stdout.write(
      `${depotOut}: ${depotFile.length} bytes, ${(hero.pos.length + heroGlow.pos.length + rackRifle.pos.length) / 9} triangles\n`,
    )
    const propsOut = path.join(path.dirname(out), 'props.glb'),
      propsFile = buildProps()
    writeFileSync(propsOut, propsFile)
    process.stdout.write(
      `${propsOut}: ${propsFile.length} bytes, ${(props.pos.length + propsGlow.pos.length) / 9} triangles\n`,
    )
    for (const part of TERRAIN_PARTS) {
      const partOut = path.join(path.dirname(out), `${part}.glb`),
        partFile = buildTerrain(part)
      writeFileSync(partOut, partFile)
      process.stdout.write(
        `${partOut}: ${partFile.length} bytes, ${terrainPart(part).pos.length / 9} triangles\n`,
      )
    }
  }
}
