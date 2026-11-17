/* oxlint-disable id-length, import/newline-after-import, import/no-nodejs-modules, no-magic-numbers, node/no-sync, typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return, unicorn/import-style -- golden-vector oracle and fixtures (SDK-SPLIT SP4): written to match the engine side byte for byte */
// Golden vectors for SDK-SPLIT SP4e2, from the ENGINE's readColliderRows, poseOf and placeCollider (three.js math, the oracle).
// Usage: node --import <engine>/scripts/sim-node-loader.mjs src/format/colliders.golden-gen.mjs <engine src> <out.json>
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  ALL_KINDS,
  COLLIDER_ROWS,
  POSE_CASES,
  ROW_CASES,
  SURFACES,
  plainBits,
  rowsAnswer,
} from './colliders.golden-specs.ts'
const { readColliderRows, poseOf, placeCollider } = await import(
  join(process.argv[2], 'client/engine/models/colliders.ts')
)
const HOST = `${process.platform}-${process.arch}`
const Matrix4 = poseOf({ x: 0, y: 0, z: 0 }).matrix.constructor
const placement = p =>
  p.matrix === undefined
    ? p
    : { ...p, matrix: new Matrix4().fromArray(p.matrix) }
const rows = readColliderRows(COLLIDER_ROWS, {
  kinds: ALL_KINDS,
  surfaces: SURFACES,
})
const poses = POSE_CASES.map(p => {
  const pose = poseOf(placement(p))
  return {
    pose: plainBits({
      x: pose.x,
      y: pose.y,
      z: pose.z,
      matrix: [...pose.matrix.elements],
      quat: { x: pose.quat.x, y: pose.quat.y, z: pose.quat.z, w: pose.quat.w },
      scale: pose.scale,
      upright: pose.upright,
    }),
    placed: rows.map(row => plainBits(placeCollider(row, pose))),
  }
})
const grammar = ROW_CASES.map(c =>
  rowsAnswer(() =>
    readColliderRows(c.rows, {
      kinds: c.kinds,
      surfaces: c.surfaces,
      ...(c.requireSurface === undefined
        ? {}
        : { requireSurface: c.requireSurface }),
    }),
  ),
)
writeFileSync(
  process.argv[3],
  `${JSON.stringify({ about: 'SDK-SPLIT SP4e2: engine models/colliders.ts readColliderRows, poseOf and placeCollider over colliders.golden-specs.ts; floats are IEEE-754 float64 bits, big-endian hex; host is the answering platform-arch (libm trig)', host: HOST, poses, grammar })}\n`,
)
