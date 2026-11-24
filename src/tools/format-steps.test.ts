// oxlint-disable typescript/prefer-readonly-parameter-types -- a chain step edits the shard it is handed, in place
import assert from 'node:assert/strict'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'

import { FORMAT_MIGRATIONS } from '../format/format-migrations.ts'

import type { MigratingShard } from '../format/format-migrations.ts'

// ZONE-SNAPSHOTS ZS4 (J507): each chain step is proved on a tiny made-up file, never a stored zone. A step's
// `corpus/format-steps/<id>.json` holds `before` (the shape the step rewrites, in a made-up shard) and `after`. A step
// with no fixture fails here, and so does a fixture with no step: a step and its fixture are deleted together.
// `node src/tools/format-steps.test.ts --write` records `after` once a new `before` is written by hand.

interface StepJson {
  readonly index: Record<string, unknown>
  readonly sections: Readonly<Record<string, unknown>>
  readonly mounts: Readonly<Record<string, unknown>>
}

const STEPS = path.resolve(import.meta.dirname, '../../corpus/format-steps')
const WRITE_FLAG = '--write'
const INDENT = 1
const SUFFIX = '.json'

function shardOf(json: Readonly<StepJson>): MigratingShard {
  const copy: unknown = structuredClone(json)
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the fixture's own shape, checked by the deep-equal below
  const own = copy as StepJson
  return {
    index: own.index,
    sections: new Map(Object.entries(own.sections)),
    mounts: new Map(Object.entries(own.mounts)),
  }
}

function jsonOf(shard: Readonly<MigratingShard>): StepJson {
  return {
    index: shard.index,
    sections: Object.fromEntries(shard.sections),
    mounts: Object.fromEntries(shard.mounts),
  }
}

async function fixture(
  id: string,
): Promise<Readonly<{ before: StepJson; after?: StepJson }>> {
  const parsed: unknown = JSON.parse(
    await readFile(path.join(STEPS, `${id}${SUFFIX}`), 'utf8'),
  )
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a hand-written fixture; the test compares it whole
  return parsed as { before: StepJson; after?: StepJson }
}

function applied(id: string, before: Readonly<StepJson>): StepJson {
  const step = FORMAT_MIGRATIONS.find(
    (one: Readonly<{ id: string }>): boolean => one.id === id,
  )
  assert.ok(
    step !== undefined,
    `corpus/format-steps/${id}.json names no chain step`,
  )
  const shard = shardOf(before)
  step.apply(shard)
  return jsonOf(shard)
}

const ids = FORMAT_MIGRATIONS.map(
  (step: Readonly<{ id: string }>): string => step.id,
)

if (process.argv.includes(WRITE_FLAG)) {
  for (const id of ids) {
    // eslint-disable-next-line no-await-in-loop -- fifteen small files
    const { before } = await fixture(id)
    // eslint-disable-next-line no-await-in-loop -- as above
    await writeFile(
      path.join(STEPS, `${id}${SUFFIX}`),
      `${JSON.stringify({ before, after: applied(id, before) }, undefined, INDENT)}\n`,
    )
  }
} else {
  test('every chain step has a made-up fixture, and every fixture a step', async (): Promise<void> => {
    const files = await readdir(STEPS)
    const named = files.map((file: string): string =>
      file.slice(0, -SUFFIX.length),
    )
    assert.deepEqual(named.toSorted(), ids.toSorted())
  })

  for (const id of ids) {
    test(`chain step ${id} rewrites its made-up before into its after`, async (): Promise<void> => {
      const { before, after } = await fixture(id)
      assert.notDeepEqual(
        after,
        before,
        `${id}: the before must carry the shape the step rewrites`,
      )
      assert.deepEqual(applied(id, before), after)
    })
  }
}
