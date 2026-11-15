import { safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { ManifestMetadataSchema } from './minimap.ts'

// TEMPLATE-E2E (opus-brassgun4): every map POI is a place a fallen player comes back to, so a death in Brasscap's Wyrm pit
// came back in the pit. A POI may opt out with `respawn: false`.
const poiRows = ManifestMetadataSchema.entries.pois
const place = (
  id: string,
  at: readonly [number, number],
  respawn?: unknown,
): Readonly<Record<string, unknown>> => {
  const entries: [string, unknown][] = [
    ['id', id],
    ['name', id],
    ['x', at[0]],
    ['z', at[1]],
  ]
  if (respawn !== undefined) {
    entries.push(['respawn', respawn])
  }
  const row: Record<string, unknown> = Object.fromEntries(entries)
  return row
}

test('a map POI may say it is no respawn place', (): void => {
  const rows = [place('pit', [2, -100], false), place('depot', [0, 0])]
  const parsed = safeParse(poiRows, rows)
  expect(parsed.success).toBe(true)
  expect(parsed.output).toEqual(rows)
  expect(safeParse(poiRows, [place('pit', [2, -100], 'no')]).success).toBe(
    false,
  )
})
