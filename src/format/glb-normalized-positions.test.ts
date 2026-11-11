import { readFileSync } from 'node:fs'

import { expect, test } from 'vitest'

import { parseGlb, prepareAssetDecoders, visitGlbTriangles } from './product.ts'

import type { GlbVertex } from './glbTriangles.ts'

test('normalized Int16 positions are admitted and placed by their node scale', async (): Promise<void> => {
  await prepareAssetDecoders()
  // The GLB holds one normalized Int16 triangle with a scaled, translated node.
  const bytes = readFileSync(
    new URL('fixtures/normalized-triangle.glb', import.meta.url),
  )
  const triangles: number[][][] = []
  visitGlbTriangles(bytes, (triangle: readonly Readonly<GlbVertex>[]): void => {
    triangles.push(
      triangle.map((point: Readonly<GlbVertex>): number[] => [
        point.x,
        point.y,
        point.z,
      ]),
    )
  })
  expect(parseGlb(bytes).triangles).toBe(1)
  expect(triangles).toEqual([
    [
      [-90, 0, 0],
      [110, 0, 0],
      [10, 0, 50],
    ],
  ])
})
