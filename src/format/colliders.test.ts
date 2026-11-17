/* oxlint-disable id-length, typescript/explicit-function-return-type, typescript/no-unsafe-type-assertion, typescript/prefer-readonly-parameter-types -- golden-vector oracle and fixtures (SDK-SPLIT SP4): written to match the engine side byte for byte */
// SDK-SPLIT SP4e2 (Q35): collider rows and how a pose places them are format laws. colliders.golden.json was answered by
// the engine's own readColliderRows, poseOf and placeCollider, on three.js math (colliders.golden-gen.mjs), over
// colliders.golden-specs.ts, so this proves format's three-free copies admit, pose and place bit for bit.
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  ALL_KINDS,
  COLLIDER_ROWS,
  POSE_CASES,
  ROW_CASES,
  SURFACES,
  plainBits,
  rowsAnswer,
} from './colliders.golden-specs.ts'
import { placeCollider, poseOf, readColliderRows } from './colliders.ts'

interface Golden {
  readonly poses: readonly {
    readonly pose: unknown
    readonly placed: readonly unknown[]
  }[]
  readonly grammar: readonly unknown[]
}
const golden = JSON.parse(
  readFileSync(new URL('colliders.golden.json', import.meta.url), 'utf8'),
) as Golden

describe('colliders match the engine bit for bit', () => {
  it('admits and refuses the same row batches', () => {
    expect(
      ROW_CASES.map(c =>
        rowsAnswer(() =>
          readColliderRows(c.rows, {
            kinds: c.kinds,
            surfaces: c.surfaces,
            ...(c.requireSurface === undefined
              ? {}
              : { requireSurface: c.requireSurface }),
          }),
        ),
      ),
    ).toEqual(golden.grammar)
  })
  const rows = readColliderRows(COLLIDER_ROWS, {
    kinds: ALL_KINDS,
    surfaces: SURFACES,
  })
  for (const [index, placement] of POSE_CASES.entries()) {
    it(`pose ${index}: the pose and every shape placed at it`, () => {
      const want = golden.poses[index]
      const pose = poseOf(placement)
      expect(
        plainBits({
          x: pose.x,
          y: pose.y,
          z: pose.z,
          matrix: [...pose.matrix],
          quat: pose.quat,
          scale: pose.scale,
          upright: pose.upright,
        }),
      ).toEqual(want?.pose)
      expect(rows.map(row => plainBits(placeCollider(row, pose)))).toEqual(
        want?.placed,
      )
    })
  }
})
