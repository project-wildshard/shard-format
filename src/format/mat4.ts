/* oxlint-disable capitalized-comments, id-length, import/exports-last, import/group-exports, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/no-unsafe-type-assertion, unicorn/prefer-modern-math-apis -- a port of engine's GLB rest reading and three.js 0.186's matrix steps (SHARD-COMPAT PR6a), kept term for term so the values match the engine byte for byte */
// SHARD-COMPAT PR6a (J487): the 4 x 4 matrix steps the creature rest rig needs, with no renderer. Each is the same
// arithmetic, in the same order, as three.js 0.186 `Matrix4.determinant`, `Matrix4.invert`, `Matrix4.decompose` and
// `Quaternion.setFromRotationMatrix` (column-major elements), so a rest joint computed here is bit for bit the one
// engine computed with three. three.js is MIT licensed (Copyright 2010-2025 three.js authors).

/** A column-major 4 x 4 matrix, as glTF and three store it. */
export type Mat4 = readonly number[]

type Sixteen = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
]

/** A matrix's translation, unit-free rotation quaternion and axis scales. */
export interface Decomposed {
  readonly position: readonly [number, number, number]
  readonly quaternion: readonly [number, number, number, number]
  readonly scale: readonly [number, number, number]
}

const QUARTER = 0.25
const HALF = 0.5
const TWO = 2
const SIZE = 16

function sixteen(te: Mat4): Sixteen {
  if (te.length !== SIZE) {
    throw new Error('A 4 x 4 matrix has 16 elements')
  }
  return te as Sixteen
}

/** three's `Matrix4.determinant`. */
export function determinant(te: Mat4): number {
  const [
    n11,
    n21,
    n31,
    n41,
    n12,
    n22,
    n32,
    n42,
    n13,
    n23,
    n33,
    n43,
    n14,
    n24,
    n34,
    n44,
  ] = sixteen(te)
  const t11 = n23 * n34 - n24 * n33
  const t12 = n22 * n34 - n24 * n32
  const t13 = n22 * n33 - n23 * n32
  const t21 = n21 * n34 - n24 * n31
  const t22 = n21 * n33 - n23 * n31
  const t23 = n21 * n32 - n22 * n31
  return (
    n11 * (n42 * t11 - n43 * t12 + n44 * t13) -
    n12 * (n41 * t11 - n43 * t21 + n44 * t22) +
    n13 * (n41 * t12 - n42 * t21 + n44 * t23) -
    n14 * (n41 * t13 - n42 * t22 + n43 * t23)
  )
}

/** three's `Matrix4.invert` intermediate terms t1 to t12. */
function inverseTerms(te: Sixteen): readonly number[] {
  const [
    n11,
    n21,
    n31,
    n41,
    n12,
    n22,
    n32,
    n42,
    n13,
    n23,
    n33,
    n43,
    n14,
    n24,
    n34,
    n44,
  ] = te
  return [
    n11 * n22 - n21 * n12,
    n11 * n32 - n31 * n12,
    n11 * n42 - n41 * n12,
    n21 * n32 - n31 * n22,
    n21 * n42 - n41 * n22,
    n31 * n42 - n41 * n32,
    n13 * n24 - n23 * n14,
    n13 * n34 - n33 * n14,
    n13 * n44 - n43 * n14,
    n23 * n34 - n33 * n24,
    n23 * n44 - n43 * n24,
    n33 * n44 - n43 * n34,
  ]
}

/** three's `Matrix4.invert`: all zeros for a singular matrix. */
export function invert(matrix: Mat4): Mat4 {
  const te = sixteen(matrix)
  const [
    n11,
    n21,
    n31,
    n41,
    n12,
    n22,
    n32,
    n42,
    n13,
    n23,
    n33,
    n43,
    n14,
    n24,
    n34,
    n44,
  ] = te
  const [t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12] = inverseTerms(
    te,
  ) as Sixteen
  const det = t1 * t12 - t2 * t11 + t3 * t10 + t4 * t9 - t5 * t8 + t6 * t7
  if (det === 0) {
    return Array.from({ length: SIZE }, () => 0)
  }
  const detInv = 1 / det
  return [
    (n22 * t12 - n32 * t11 + n42 * t10) * detInv,
    (n31 * t11 - n21 * t12 - n41 * t10) * detInv,
    (n24 * t6 - n34 * t5 + n44 * t4) * detInv,
    (n33 * t5 - n23 * t6 - n43 * t4) * detInv,
    (n32 * t9 - n12 * t12 - n42 * t8) * detInv,
    (n11 * t12 - n31 * t9 + n41 * t8) * detInv,
    (n34 * t3 - n14 * t6 - n44 * t2) * detInv,
    (n13 * t6 - n33 * t3 + n43 * t2) * detInv,
    (n12 * t11 - n22 * t9 + n42 * t7) * detInv,
    (n21 * t9 - n11 * t11 - n41 * t7) * detInv,
    (n14 * t5 - n24 * t3 + n44 * t1) * detInv,
    (n23 * t3 - n13 * t5 - n43 * t1) * detInv,
    (n22 * t8 - n12 * t10 - n32 * t7) * detInv,
    (n11 * t10 - n21 * t8 + n31 * t7) * detInv,
    (n24 * t2 - n14 * t4 - n34 * t1) * detInv,
    (n13 * t4 - n23 * t2 + n33 * t1) * detInv,
  ]
}

/** three's `Matrix4.determinantAffine`. */
function determinantAffine(te: Sixteen): number {
  const [n11, n21, n31, , n12, n22, n32, , n13, n23, n33] = te
  return (
    n11 * (n22 * n33 - n23 * n32) -
    n12 * (n21 * n33 - n23 * n31) +
    n13 * (n21 * n32 - n22 * n31)
  )
}

/** three's `Quaternion.setFromRotationMatrix`, on the scaled-out 3 x 3 (m11 to m33, row by row). */
function rotationQuaternion(
  m: readonly number[],
): readonly [number, number, number, number] {
  const [m11, m12, m13, m21, m22, m23, m31, m32, m33] = m as Sixteen
  const trace = m11 + m22 + m33
  if (trace > 0) {
    const s = HALF / Math.sqrt(trace + 1)
    return [(m32 - m23) * s, (m13 - m31) * s, (m21 - m12) * s, QUARTER / s]
  }
  if (m11 > m22 && m11 > m33) {
    const s = TWO * Math.sqrt(1 + m11 - m22 - m33)
    return [QUARTER * s, (m12 + m21) / s, (m13 + m31) / s, (m32 - m23) / s]
  }
  if (m22 > m33) {
    const s = TWO * Math.sqrt(1 + m22 - m11 - m33)
    return [(m12 + m21) / s, QUARTER * s, (m23 + m32) / s, (m13 - m31) / s]
  }
  const s = TWO * Math.sqrt(1 + m33 - m11 - m22)
  return [(m13 + m31) / s, (m23 + m32) / s, QUARTER * s, (m21 - m12) / s]
}

/** three's `Matrix4.decompose`: position, rotation (x, y, z, w) and scale. */
export function decompose(matrix: Mat4): Decomposed {
  const te = sixteen(matrix)
  const [a0, a1, a2, , a4, a5, a6, , a8, a9, a10, , px, py, pz] = te
  const position = [px, py, pz] as const
  const det = determinantAffine(te)
  if (det === 0) {
    return { position, quaternion: [0, 0, 0, 1], scale: [1, 1, 1] }
  }
  const length = Math.sqrt(a0 * a0 + a1 * a1 + a2 * a2)
  const sx = det < 0 ? -length : length
  const sy = Math.sqrt(a4 * a4 + a5 * a5 + a6 * a6)
  const sz = Math.sqrt(a8 * a8 + a9 * a9 + a10 * a10)
  const [ix, iy, iz] = [1 / sx, 1 / sy, 1 / sz]
  const rows = [
    a0 * ix,
    a4 * iy,
    a8 * iz,
    a1 * ix,
    a5 * iy,
    a9 * iz,
    a2 * ix,
    a6 * iy,
    a10 * iz,
  ]
  return { position, quaternion: rotationQuaternion(rows), scale: [sx, sy, sz] }
}
