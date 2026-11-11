import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import { readSessionArchive } from '../bench/capture/session-archive.ts'
import { replay } from '../bench/capture/v1-frames.ts'
import { PLAYER, WIRE_CLASSES } from '../src/classes.ts'
import { classColumns } from '../src/columns.ts'
import { projectClasses, projectRow } from '../src/projection.ts'

import type { WireClass, WireClassField } from '../src/grammar.ts'

// WR4's Opus review: J140 in both skew directions, with the player itself
// skewed. Over the whole ride recording (mounted play, lost commands and
// their corrections), a receiver missing an owner field and a sender with an
// extra owner field before `px` both project px, py, pz, vx, vy, vz with
// every bit of the recorded owner block.

const LOCAL: readonly WireClass[] = WIRE_CLASSES
const DOUBLES = [11, 12, 13, 14, 15, 16]
const STAMINA: WireClassField = {
  id: 55,
  name: 'stamina',
  node: { kind: 'f32' },
  send: 'owner',
}
const PX = PLAYER.fields.findIndex(
  (field: WireClassField): boolean => field.name === 'px',
)
/** The player with `stamina` declared just before `px`. */
const WITH_STAMINA: WireClass = {
  ...PLAYER,
  fields: [...PLAYER.fields.slice(0, PX), STAMINA, ...PLAYER.fields.slice(PX)],
}
/** The player without `led`, an owner field no predictor needs. */
const WITHOUT_LED: WireClass = {
  ...PLAYER,
  fields: PLAYER.fields.filter(
    (field: WireClassField): boolean => field.name !== 'led',
  ),
}
const swap = (player: WireClass): readonly WireClass[] =>
  LOCAL.map((entry: WireClass): WireClass =>
    entry === PLAYER ? player : entry,
  )

/** Each double's IEEE bits, by field id. */
function bitsById(
  player: WireClass,
  owner: Readonly<Float64Array>,
): readonly bigint[] {
  const columns = classColumns(player).owner
  return DOUBLES.map((id: number): bigint => {
    const at = columns.findIndex(
      (column: { readonly id: number }): boolean => column.id === id,
    )
    const view = new DataView(new ArrayBuffer(8))
    view.setFloat64(0, owner[at] ?? Number.NaN)
    return view.getBigUint64(0)
  })
}

async function owners(): Promise<readonly Readonly<Float64Array>[]> {
  const dir = new URL('../bench/recordings/ride/', import.meta.url)
  const manifest: unknown = JSON.parse(
    await readFile(new URL('manifest.json', dir), 'utf8'),
  )
  const session = await readSessionArchive(
    manifest,
    async (file: string): Promise<Readonly<Uint8Array>> =>
      await readFile(new URL(file, dir)),
  )
  return session.frames.map((record): Readonly<Float64Array> => {
    const { raw } = replay(record)
    assert.ok(raw)
    return raw.owner
  })
}

test('a receiver missing an owner field keeps every f64 bit', async (): Promise<void> => {
  const projection = projectClasses(LOCAL, swap(WITHOUT_LED)).get(PLAYER.id)
  assert.ok(projection)
  for (const owner of await owners()) {
    const projected = projectRow(projection.owner, owner)
    assert.deepEqual(bitsById(WITHOUT_LED, projected), bitsById(PLAYER, owner))
  }
})

test('a sender with an extra owner field before px keeps every f64 bit', async (): Promise<void> => {
  const projection = projectClasses(swap(WITH_STAMINA), LOCAL).get(PLAYER.id)
  assert.ok(projection)
  const at = classColumns(WITH_STAMINA).owner.findIndex(
    (column: { readonly id: number }): boolean => column.id === STAMINA.id,
  )
  for (const owner of await owners()) {
    // The newer sender's owner block: the same words with stamina spliced in.
    const sent = Float64Array.from([
      ...owner.subarray(0, at),
      1_065_353_216,
      ...owner.subarray(at),
    ])
    const projected = projectRow(projection.owner, sent)
    assert.deepEqual(bitsById(PLAYER, projected), bitsById(PLAYER, owner))
    assert.deepEqual([...projected], [...owner])
  }
})
