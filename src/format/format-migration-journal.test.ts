// oxlint-disable typescript/prefer-readonly-parameter-types, typescript/no-unsafe-type-assertion -- a test edits its own shard and reads it back from JSON
import { describe, expect, test } from 'vitest'

import { journalGlyphImages } from './format-migration-journal.ts'

import type { MigratingShard } from './format-migrations.ts'

// SHARD-COMPAT CP1: the step that mends shard-format 036b383's unmigrated break (journal icons became image-only).

interface Icon {
  readonly image?: string
  readonly tint?: string
  readonly icon?: string
  readonly entryKind?: string
}

const BUDGET = 1000
const PIXEL_BYTES = 8
const SIDE = 64
const DISTINCT = 2

function shardWith(icons: readonly object[]): MigratingShard {
  return {
    index: { admission: { budgets: { library: { resident: BUDGET } } } },
    mounts: new Map<string, unknown>(),
    sections: new Map<string, unknown>([
      [
        'ui/compendium',
        { rows: { compendiums: [{ kind: 'journal', icons: [...icons] }] } },
      ],
    ]),
  }
}

function iconsOf(shard: MigratingShard): readonly Icon[] {
  const section = shard.sections.get('ui/compendium') as {
    rows: { compendiums: { icons: Icon[] }[] }
  }
  return section.rows.compendiums[0]?.icons ?? []
}

function residentOf(shard: MigratingShard): number {
  return (
    shard.index as { admission: { budgets: { library: { resident: number } } } }
  ).admission.budgets.library.resident
}

describe('journal-glyph-images', (): void => {
  test('writes each retired glyph as its tinted image and raises the library budget', (): void => {
    const shard = shardWith([
      { entryKind: 'boss', icon: 'antlers' },
      { icon: 'deer', matchKind: 'deer' },
      { icon: 'deer', matchKind: 'elk' },
    ])
    expect(journalGlyphImages.repairs?.(shard)).toBe(true)
    journalGlyphImages.apply(shard)
    const icons = iconsOf(shard)
    expect(
      icons.every(
        (icon: Icon): boolean =>
          icon.image?.startsWith('data:image/svg+xml,') === true &&
          icon.tint === 'currentColor' &&
          icon.icon === undefined,
      ),
    ).toBe(true)
    expect(icons[0]).toMatchObject({ entryKind: 'boss' })
    // Two distinct 64x64 images, each decoded and on the GPU at four bytes a pixel.
    expect(residentOf(shard)).toBe(
      BUDGET + DISTINCT * SIDE * SIDE * PIXEL_BYTES,
    )
    expect(journalGlyphImages.repairs?.(shard)).toBe(false)
  })

  test('leaves image icons alone and refuses a glyph it has no image for', (): void => {
    const image = { image: `commons:${'a'.repeat(SIDE)}` }
    const kept = shardWith([image])
    journalGlyphImages.apply(kept)
    expect(iconsOf(kept)).toEqual([image])
    expect(residentOf(kept)).toBe(BUDGET)
    expect((): void => {
      journalGlyphImages.apply(shardWith([{ icon: 'dragon' }]))
    }).toThrow(/dragon/u)
  })
})
