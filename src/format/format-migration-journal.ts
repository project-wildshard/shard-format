// oxlint-disable typescript/prefer-readonly-parameter-types -- a step edits the shard it is handed, in place
/** A chain step for a break that shipped without one (SHARD-COMPAT CP1, J486): shard-format 036b383 made a journal
 * compendium's icons image-only, so Pine Hollow r1 to r6 (r5 is production's pointer) stopped validating. The step
 * writes each retired glyph name as the inert SVG image the engine drew for it (`journal-glyphs.json`), and raises the
 * declared library budget by those images' rasters, which a glyph never cost. It repairs 0.1.0.1 files too, since the
 * break landed inside 0.1.0.1. */
import table from './journal-glyphs.json' with { type: 'json' }
import { parseSketchSvg } from './sketch.ts'

import type { FormatMigration, MigratingShard } from './format-migrations.ts'

type JsonRecord = Record<string, unknown>

const SECTION = 'ui/compendium'
const GLYPHS: Readonly<Record<string, string>> = table.glyphs
const PREFIX = 'data:image/svg+xml,'
const NONE = 0

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The retired glyph an icon names, if it names one. */
function glyphOf(icon: unknown): string | undefined {
  if (!isRecord(icon)) {
    return undefined
  }
  const { icon: glyph } = icon
  return typeof glyph === 'string' ? glyph : undefined
}

/** A journal row's icons, when the row is a journal with icons. */
function journalIcons(row: unknown): readonly unknown[] | undefined {
  if (!isRecord(row) || row['kind'] !== 'journal') {
    return undefined
  }
  const { icons } = row
  return Array.isArray(icons) ? icons : undefined
}

function compendiumRows(shard: Readonly<MigratingShard>): readonly unknown[] {
  const section = shard.sections.get(SECTION)
  const rows =
    isRecord(section) && isRecord(section['rows'])
      ? section['rows']['compendiums']
      : undefined
  return Array.isArray(rows) ? rows : []
}

/** One icon: a retired glyph becomes its image, tinted by the page as before; any other icon stays as it is. */
function imageIcon(icon: unknown): unknown {
  const glyph = glyphOf(icon)
  if (glyph === undefined || !isRecord(icon)) {
    return icon
  }
  const image = GLYPHS[glyph]
  if (image === undefined) {
    throw new Error(`No image for the retired journal glyph ${glyph}`)
  }
  const { icon: _retired, ...selectors } = icon
  return { ...selectors, image, tint: 'currentColor' }
}

/** Rewrite one journal row's icons; the images it newly names. */
function migrateRow(row: unknown): readonly string[] {
  const icons = journalIcons(row)
  if (icons === undefined || !isRecord(row)) {
    return []
  }
  row['icons'] = icons.map((icon: unknown): unknown => imageIcon(icon))
  return icons.flatMap((icon: unknown): string[] => {
    const glyph = glyphOf(icon)
    return glyph === undefined ? [] : [GLYPHS[glyph] ?? '']
  })
}

/** The raster bytes the new images add, each distinct image once, as compendium sketch admission counts them. */
function rasterBytes(images: readonly string[]): number {
  let total = NONE
  for (const image of new Set(images)) {
    const sketch = parseSketchSvg(
      decodeURIComponent(image.slice(PREFIX.length)),
    )
    total += sketch.decoded + sketch.gpu
  }
  return total
}

/** Raise `admission.budgets.library.resident` by `bytes`. */
function raiseLibrary(index: JsonRecord, bytes: number): void {
  const { admission } = index
  const budgets = isRecord(admission) ? admission['budgets'] : undefined
  const library = isRecord(budgets) ? budgets['library'] : undefined
  if (!isRecord(library) || typeof library['resident'] !== 'number') {
    throw new TypeError(
      'A journal glyph migration needs a declared library budget',
    )
  }
  library['resident'] += bytes
}

function applyJournalImages(shard: MigratingShard): void {
  const images = compendiumRows(shard).flatMap(
    (row: unknown): readonly string[] => migrateRow(row),
  )
  if (images.length > NONE) {
    raiseLibrary(shard.index, rasterBytes(images))
  }
}

/** Whether any journal row still names a retired glyph (0.1.0.1 files written before the break carry them). */
function namesGlyph(shard: Readonly<MigratingShard>): boolean {
  return compendiumRows(shard).some((row: unknown): boolean =>
    (journalIcons(row) ?? []).some(
      (icon: unknown): boolean => glyphOf(icon) !== undefined,
    ),
  )
}

const journalGlyphImages: FormatMigration = {
  id: 'journal-glyph-images',
  to: '0.1.0.1',
  touches: 'data',
  affects: [],
  apply: applyJournalImages,
  repairs: namesGlyph,
}

export { journalGlyphImages }
