/* oxlint-disable eslint/no-magic-numbers, eslint/id-length, unicorn/numeric-separators-style, unicorn/number-literal-case, typescript/no-non-null-assertion, eslint/sort-vars, eslint/no-plusplus, typescript/explicit-function-return-type, eslint/max-params, eslint/max-statements, typescript/prefer-readonly-parameter-types, eslint/max-lines-per-function, node/no-sync, import/exports-last, import/group-exports, eslint/max-lines, typescript/explicit-member-accessibility, unicorn/max-nested-calls, eslint/no-shadow, eslint/curly, eslint/capitalized-comments, unicorn/no-array-for-each, unicorn/no-array-callback-reference -- Author-side model data, a stand-in for a Blender export: coordinates, colours and keyframes, never shipped or imported. */
// Brasscap Mesa (Template 2) Dust Wyrm, BM-5's model in meta
// TEMPLATE-E2E-PLAN. An author-side stand-in for the Blender export, like
// bandit.ts (BM-4): a flat-shaded, vertex-coloured low-poly skinned creature
// as one GLB, for a `platform.skin` look. A sand mound with a plated
// segmented body rising out of it and arching over toward +Z (terracotta
// plates, cream spines down its back), ending in a round maw: a cream rim
// with eight teeth round a dark throat and the bright yellow gullet, open
// in every pose as the targets draw it (LF2-8). About 2.1 m tall at scale 1
// (the spawn scales it), its base at y = 0, facing +Z.
//
// Joints, in skin order: `body` (root, the lower segments), `neck`, `head`
// and `jaw` (the maw's lower lip: the rim's lower half and lower four
// teeth, hinged at the rim's foot), each a child of the one before;
// all four are sockets. The bind pose is unrotated and unscaled.
//
// Clips, linear keys on every joint's translation and rotation (every clip
// sets all four, so no pose leaks between clips):
//   `attack.rise`  the body heaves up out of the mound and rears back,
//   `attack.burst` it slams its head down into the sand (the sand-ring tell),
//   `attack.open`  it lifts its head and the jaw drops: the maw gapes wide
//                  (shipped for when engine can play a clip from a field;
//                  until then the open window shows as gullet particles),
//   `attack`       rise then burst, since engine plays `attack` across a
//                  strike's windup only and cancels it as the strike lands:
//                  the burst's slam meets the windup's end,
//   `idle`         a slow weave, the jaw at rest; `hit` a recoil; `die` it
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

// LF2-8: lighter than BM-5's, so the Wyrm reads warm against the low sun behind it, not dark.
const SAND = 0xe2b47a,
  SAND_SHADE = 0xc99a5e,
  TERRA = 0xd0693c,
  TERRA_SHADE = 0xb1532e,
  TERRA_LIGHT = 0xe08a58,
  CREAM = 0xf4e6c4,
  CREAM_SHADE = 0xdcc79c,
  MAW = 0x4a1c12,
  MAW_DEEP = 0x6e2a14,
  GULLET = 0xfff27a,
  GULLET_DEEP = 0xffb02e

/** Joint indices, in the skin's joint order. */
const BODY = 0,
  NECK = 1,
  HEAD = 2,
  JAW = 3
type Vec = [number, number, number]
const add = (a: V3, b: V3, k = 1): Vec => [
  a[0] + b[0] * k,
  a[1] + b[1] * k,
  a[2] + b[2] * k,
]
/** The curve's side axis: the Wyrm arches in the y-z plane, so every ring's first axis is +x. */
const SIDE: V3 = [1, 0, 0]
/** A ring's second axis for tangent `t`: x cross t, in the y-z plane (+z at the upright base: the front). */
const front = (t: V3): V3 => [0, -t[2], t[1]]
const dir = (theta: number): V3 => [0, Math.cos(theta), Math.sin(theta)]
function ringAt(c: V3, t: V3, r: number, sides: number): Vec[] {
  const n = front(t)
  return Array.from({ length: sides }, (_, i) => {
    const a = ((i + 0.5) / sides) * Math.PI * 2
    return add(add(c, SIDE, Math.cos(a) * r), n, Math.sin(a) * r)
  })
}

/**
 * LF2-8: the spine's lean from upright, per segment (radians toward +z, the front). The body rises out of the mound
 * and arches over toward the player, so the round maw at its end faces them, as `t2-14` and `t2-15` draw it.
 */
const LEAN = [0, 0.06, 0.16, 0.32, 0.52, 0.78, 1.04, 1.3] as const
const HEAD_LEAN = 1.62
const SEGMENT = 0.235
const RADII = [0.5, 0.5, 0.49, 0.47, 0.46, 0.45, 0.45, 0.48, 0.56] as const
/**
 * Seen from the front the arch would be a straight column, so it also sweeps across: the base sits off to -x and the
 * body swings back over the mound's centre as it rises, the maw centred (the curve of `t2-15`).
 */
const SWEEP = [-0.4, -0.42, -0.4, -0.34, -0.25, -0.15, -0.07, -0.02, 0] as const
/** Spine points p0..p8 and the tangent at each (the mean of the segments meeting there, in the y-z plane). */
const SPINE: V3[] = [[SWEEP[0], 0.06, 0]]
LEAN.forEach((theta, k): void => {
  const at = add(SPINE.at(-1)!, dir(theta), SEGMENT)
  SPINE.push([SWEEP[k + 1]!, at[1], at[2]])
})
const TANGENT: V3[] = SPINE.map((_, k): V3 => {
  const before = LEAN[k - 1] ?? LEAN[0],
    after = LEAN[k] ?? HEAD_LEAN
  return dir((before + after) / 2)
})
/** The segment a joint owns from: body p0..p2, neck p3..p5, head p6 on. */
function ownerOf(k: number): number {
  if (k < 3) return BODY
  return k < 6 ? NECK : HEAD
}

/** The mouth's down axis at the rim (the jaw side), and the rim's centre. */
const MOUTH_T = dir(HEAD_LEAN)
const RIM = SPINE[8]!

/** World rest positions of the joints: the body in the mound, the neck and head on the arch (LF2-8). */
export const BODY_AT: V3 = [0, 0.3, 0]
export const NECK_AT: V3 = SPINE[3]!
export const HEAD_AT: V3 = SPINE[6]!
/** The jaw hinges at the bottom of the maw's rim, where the lower teeth sit. */
export const JAW_AT: V3 = add(RIM, front(MOUTH_T), 0.52)
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
  /** Per triangle: drawn in the GLB's `Gullet` material (TE-ENG10's glowing part) rather than the body's. */
  readonly glow: boolean[] = []
  glowing = false
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
    this.glow.push(this.glowing)
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

/** A frustum from ring (a, ta, ra) to ring (b, tb, rb), faces alternating two shades, outward from its axis. */
function frustum(
  a: V3,
  ta: V3,
  ra: number,
  b: V3,
  tb: V3,
  rb: number,
  hex: Hex,
  shade: Hex,
  joint: number | ((face: number) => number),
  sides = 8,
): void {
  const ring0 = ringAt(a, ta, ra, sides),
    ring1 = ringAt(b, tb, rb, sides),
    centre: V3 = add(a, add(b, a, -1), 0.5)
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides
    mesh.quad(
      ring0[i]!,
      ring0[j]!,
      ring1[j]!,
      ring1[i]!,
      i % 2 === 0 ? hex : shade,
      typeof joint === 'number' ? joint : joint(i),
      centre,
    )
  }
}
/** A three-sided cone from a base round `at` (perpendicular to the tip) to `tip`. */
function cone(at: V3, tip: V3, r: number, hex: Hex, joint: number): void {
  const axis = add(tip, at, -1),
    len = Math.hypot(...axis),
    t: V3 = [axis[0] / len, axis[1] / len, axis[2] / len]
  // Any axis not along t, then two perpendiculars.
  const pick: V3 = Math.abs(t[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
  const u: Vec = [
    t[1] * pick[2] - t[2] * pick[1],
    t[2] * pick[0] - t[0] * pick[2],
    t[0] * pick[1] - t[1] * pick[0],
  ]
  const ul = Math.hypot(...u),
    uu: V3 = [u[0] / ul, u[1] / ul, u[2] / ul],
    w: V3 = [
      t[1] * uu[2] - t[2] * uu[1],
      t[2] * uu[0] - t[0] * uu[2],
      t[0] * uu[1] - t[1] * uu[0],
    ]
  const base = [0, 1, 2].map(i => {
    const a = (i / 3) * Math.PI * 2
    return add(add(at, uu, Math.cos(a) * r), w, Math.sin(a) * r)
  })
  const centre = add(at, axis, 1 / 3)
  for (let i = 0; i < 3; i++)
    mesh.tri(base[i]!, base[(i + 1) % 3]!, tip, hex, joint, centre)
  mesh.tri(base[0]!, base[1]!, base[2]!, hex, joint, centre)
}

function wyrm(): void {
  // The sand mound it bursts from (on `body`, so it sinks with it on death only a little).
  mesh.ring(1.2, 0.86, 0, 0.16, SAND, SAND_SHADE, BODY, false)
  mesh.ring(0.86, 0.56, 0.16, 0.3, SAND, SAND_SHADE, BODY, true)
  // Plated segments along the arch: terracotta, each running a little into the next so a bend never opens a gap.
  for (let k = 0; k < 8; k++) {
    const a = SPINE[k]!,
      b = add(SPINE[k + 1]!, TANGENT[k + 1]!, k === 7 ? 0 : 0.04)
    frustum(
      a,
      TANGENT[k]!,
      RADII[k]!,
      b,
      k === 7 ? MOUTH_T : TANGENT[k + 1]!,
      RADII[k + 1]!,
      TERRA,
      TERRA_SHADE,
      ownerOf(k),
    )
  }
  // A raised plate rim over every joint of the arch (lighter terracotta, as the targets' plates catch the light), and
  // a cream spine on the back of most.
  for (let k = 1; k < 8; k++) {
    const c = SPINE[k]!,
      t = TANGENT[k]!,
      r = RADII[k]! + 0.04
    frustum(
      add(c, t, -0.05),
      t,
      r,
      add(c, t, 0.05),
      t,
      r,
      TERRA_LIGHT,
      TERRA,
      ownerOf(k),
    )
    if (k >= 2) {
      const back: V3 = [0, front(t)[1] * -1, front(t)[2] * -1]
      cone(
        add(c, back, r - 0.02),
        add(add(c, back, r + 0.2), t, -0.1),
        0.06,
        CREAM,
        ownerOf(k),
      )
    }
  }
  // The maw: a cream rim, a dark throat narrowing inward, and the yellow gullet at its end.
  frustum(
    add(RIM, MOUTH_T, -0.03),
    MOUTH_T,
    0.6,
    add(RIM, MOUTH_T, 0.05),
    MOUTH_T,
    0.56,
    CREAM,
    CREAM_SHADE,
    // The rim's lower half (faces centred below the mouth's axis) is the jaw's lip.
    (face: number): number =>
      Math.sin(((face + 1) / 8) * Math.PI * 2) > 1e-6 ? JAW : HEAD,
  )
  const throat: readonly (readonly [number, number, Hex, Hex])[] = [
    [0.05, 0.52, MAW, MAW_DEEP],
    [-0.12, 0.34, MAW_DEEP, MAW],
    [-0.26, 0.23, GULLET_DEEP, GULLET_DEEP],
    [-0.3, 0.17, GULLET, GULLET],
  ]
  for (let i = 0; i + 1 < throat.length; i++) {
    const [d0, r0, hex, shade] = throat[i]!,
      [d1, r1] = throat[i + 1]!
    // Inward normals: the throat's faces are wound out from a point deep behind the gullet.
    const ring0 = ringAt(add(RIM, MOUTH_T, d0), MOUTH_T, r0, 8),
      ring1 = ringAt(add(RIM, MOUTH_T, d1), MOUTH_T, r1, 8),
      deep = add(RIM, MOUTH_T, -1.2)
    for (let s = 0; s < 8; s++) {
      const j = (s + 1) % 8
      mesh.quad(
        ring0[s]!,
        ring0[j]!,
        ring1[j]!,
        ring1[s]!,
        s % 2 === 0 ? hex : shade,
        HEAD,
        deep,
      )
    }
  }
  const gullet = ringAt(add(RIM, MOUTH_T, -0.3), MOUTH_T, 0.17, 8),
    core = add(RIM, MOUTH_T, -0.3)
  // The gullet's cap is the `Gullet` part, drawn in the look's `glow` (TE-ENG10).
  mesh.glowing = true
  for (let s = 0; s < 8; s++)
    mesh.tri(
      core,
      gullet[s]!,
      gullet[(s + 1) % 8]!,
      GULLET,
      HEAD,
      add(RIM, MOUTH_T, -1.2),
    )
  mesh.glowing = false
  // Eight cream teeth round the rim, pointing in and forward; the lower four ride the jaw.
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2,
      n = front(MOUTH_T),
      out = add(add([0, 0, 0], SIDE, Math.cos(a)), n, Math.sin(a)),
      at = add(add(RIM, out, 0.5), MOUTH_T, 0.03),
      tip = add(add(RIM, out, 0.34), MOUTH_T, 0.17)
    cone(at, tip, 0.06, CREAM_SHADE, Math.sin(a) > 0 ? JAW : HEAD)
  }
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
    weights.push(255, 0, 0, 0)
  }
  const position = acc(push(f32(mesh.pos), 34962), 'VEC3', 5126, count, {
    min,
    max,
  })
  const normal = acc(push(f32(mesh.nor), 34962), 'VEC3', 5126, count)
  const colour = acc(push(f32(mesh.col), 34962), 'VEC3', 5126, count)
  // LF2-8: one byte per joint index and per weight (each triangle is bound wholly to one joint, so 255 is 1).
  const joint = acc(
    push(Buffer.from(new Uint8Array(joints).buffer), 34962),
    'VEC4',
    5121,
    count,
  )
  const weight = acc(
    push(Buffer.from(new Uint8Array(weights).buffer), 34962),
    'VEC4',
    5121,
    count,
    { normalized: true },
  )
  // TE-ENG10: the body's triangles, then the gullet's as a second primitive over the same vertices.
  const [indices, partIndices] = [false, true].map((glow): number => {
    const corners = mesh.glow.flatMap((g, t): number[] =>
      g === glow ? [t * 3, t * 3 + 1, t * 3 + 2] : [],
    )
    return acc(
      push(Buffer.from(new Uint16Array(corners).buffer), 34963),
      'SCALAR',
      5123,
      corners.length,
    )
  })
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
          {
            attributes: {
              POSITION: position,
              NORMAL: normal,
              COLOR_0: colour,
              JOINTS_0: joint,
              WEIGHTS_0: weight,
            },
            indices: partIndices,
            mode: 4,
            material: 1,
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
      {
        name: 'Gullet',
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
      materials: { Gullet: 'glow' },
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
