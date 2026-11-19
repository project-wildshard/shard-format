import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { outputFixture } from '../test/helpers/output-fixture.ts'
import { JournalRowSchema, journalImageRefs } from './compendiumRows.ts'
import { compendiumSketches } from './compendiumSketches.ts'
import { preflightAssetGraph } from './shardfile-assets.ts'
import { parseShardfile } from './shardSchema.ts'
import { parseSketchSvg } from './sketch.ts'

import type { JournalRow } from './compendiumRows.ts'

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8"><path d="M1 1L7 7" stroke="currentColor"/></svg>'
const image = parseSketchSvg(svg).data

function journal(icons: readonly unknown[]): JournalRow {
  return parse(JournalRowSchema, {
    kind: 'journal',
    id: 'journal.fixture',
    chunkId: 'fixture',
    className: 'journal',
    title: 'Wildlife',
    tabs: [{ id: 'species', label: 'Species' }],
    stamp: { place: 'Seen', default: 'Seen' },
    icons,
    stats: { place: [], default: [] },
    entries: [],
  })
}

test('a custom image crosses full row admission and legacy glyphs retain their shape', (): void => {
  const row = journal([{ entryKind: 'species', image }])
  const shard = outputFixture()
  shard.rows.compendiums.push(row)
  const admitted = parseShardfile(shard)
  expect(admitted.rows.compendiums.at(-1)).toEqual(row)
  expect(journal([{ icon: 'boar' }]).icons).toEqual([{ icon: 'boar' }])
})

test('journal image declarations refuse active SVG, external URLs and mixed syntax', (): void => {
  for (const bad of [
    'https://example.invalid/icon.png',
    true,
    `data:image/svg+xml,${encodeURIComponent(svg.replace('<path', '<script/><path'))}`,
    `data:image/svg+xml,${encodeURIComponent(svg.replace('width="8"', 'width="2048"'))}`,
  ]) {
    expect((): unknown => journal([{ image: bad }])).toThrow()
  }
  expect((): unknown => journal([{ icon: 'boar', image }])).toThrow()
})

test('image alpha may inherit sticker tint while arbitrary paints and legacy tint fields refuse', (): void => {
  const row = journal([{ image, tint: 'currentColor' }])
  const shard = outputFixture()
  shard.rows.compendiums.push(row)
  expect(parseShardfile(shard).rows.compendiums.at(-1)).toEqual(row)
  for (const tint of ['red', 'url(external)', true, 42]) {
    expect((): unknown => journal([{ image, tint }])).toThrow()
  }
  expect((): unknown =>
    journal([{ icon: 'boar', tint: 'currentColor' }]),
  ).toThrow()
})

test('raster icons use the charged image library', (): void => {
  const shard = outputFixture('corpus')
  const picture = shard.files.find(
    (file: Readonly<{ hash: string; kind: string }>): boolean =>
      file.kind === 'image' && shard.library.includes(file.hash),
  )
  if (picture === undefined) {
    throw new Error('Fixture needs a charged image')
  }
  shard.rows.compendiums = [journal([{ image: picture.hash }])]
  expect((): void => {
    preflightAssetGraph(shard)
  }).not.toThrow()
})

test('missing and non-image icon roots refuse at actual asset preflight', (): void => {
  const shard = outputFixture('corpus')
  shard.rows.compendiums = [journal([{ image: 'a'.repeat(64) }])]
  expect((): void => {
    preflightAssetGraph(shard)
  }).toThrow('Journal image must be a declared image')
  const other = shard.files.find(
    (file: Readonly<{ hash: string; kind: string }>): boolean =>
      file.kind !== 'image' && shard.library.includes(file.hash),
  )
  if (other === undefined) {
    throw new Error('Fixture needs a charged non-image')
  }
  shard.rows.compendiums = [journal([{ image: other.hash }])]
  expect((): void => {
    preflightAssetGraph(shard)
  }).toThrow('Journal image must be a declared image')
})

test('inert SVG icon raster costs are measured once through the existing sketch path', (): void => {
  const row = journal([{ image }, { matchKind: 'own.creature', image }])
  const measured = compendiumSketches({ compendiums: [row] }, new Map())
  expect(journalImageRefs(row)).toEqual([])
  expect(measured.size).toBe(1)
  expect(measured.get(image)).toMatchObject({
    width: 8,
    height: 8,
    decoded: 256,
    gpu: 256,
  })
})
