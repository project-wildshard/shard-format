import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import { FORMAT_MIGRATIONS } from '../format/format-migrations.ts'
import { SHARDFILE_VERSION } from '../format/version.ts'

/** FE11's golden file: per `<version> <fixture>`, the hash after each chain step it takes. */
async function goldens(): Promise<
  Readonly<Record<string, Readonly<Record<string, string>>>>
> {
  const text = await readFile(
    new URL('../../corpus/format-goldens.json', import.meta.url),
    'utf8',
  )
  const parsed: unknown = JSON.parse(text)
  assert.ok(typeof parsed === 'object' && parsed !== null)
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the shape is checked by the chain test that writes it
  return parsed as Readonly<Record<string, Readonly<Record<string, string>>>>
}

/** Format CI 45402400147 (11-24): FP33 and FP43 added chain steps and a format version without rewriting the goldens, and
 * only main's CI ran the 18 s chain test. This cheap check runs in every push: each registered step and the current
 * version have a golden, so a new step comes with `node src/tools/format-goldens.chain.ts --write`. */
test('every chain step and the current format version have an FE11 golden', async (): Promise<void> => {
  const recorded = await goldens()
  const steps = new Set(
    Object.values(recorded).flatMap(
      (row: Readonly<Record<string, string>>): readonly string[] =>
        Object.keys(row),
    ),
  )
  const missing = FORMAT_MIGRATIONS.map(
    (step: Readonly<{ id: string }>): string => step.id,
  ).filter((id: string): boolean => !steps.has(id))
  assert.deepEqual(
    missing,
    [],
    'run node src/tools/format-goldens.chain.ts --write and commit corpus/format-goldens.json',
  )
  assert.ok(
    Object.keys(recorded).some((key: string): boolean =>
      key.startsWith(`${SHARDFILE_VERSION} `),
    ),
    `no golden for format ${SHARDFILE_VERSION}: rewrite the goldens`,
  )
})
