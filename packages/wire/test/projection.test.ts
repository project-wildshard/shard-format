import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import { readSessionArchive } from '../bench/capture/session-archive.ts'
import { replay } from '../bench/capture/v1-frames.ts'
import { ANIMAL, PLAYER, WIRE_CLASSES } from '../src/classes.ts'
import { projectClasses, projectRides, projectRow } from '../src/projection.ts'
import { MOUNT, RIDE_LAWS } from '../src/rides.ts'

import type { WireClass, WireClassField } from '../src/grammar.ts'
import type { RawFrame } from '../src/snapshot.ts'

// WR4: a receiver one minor off in either direction projects the sender's raw
// rows onto its own classes: a column it lacks is dropped, a column the
// sender lacks reads its default, a class it lacks is kept raw and shown
// nowhere, and a sender table lacking a required field refuses before play.

interface Decoded {
  readonly raw: RawFrame
  readonly classOf: (handle: number) => number | undefined
}

const without = (wireClass: WireClass, name: string): WireClass => ({
  ...wireClass,
  fields: wireClass.fields.filter(
    (field: WireClassField): boolean => field.name !== name,
  ),
})
const MOOD: WireClassField = { id: 24, name: 'mood', node: { kind: 'bool' } }
const LOCAL: readonly WireClass[] = WIRE_CLASSES
/** An older receiver: no `animal.rideable`, and no `encounter` class at all. */
const OLDER = LOCAL.filter(
  (entry: WireClass): boolean => entry.name !== 'encounter',
).map((entry: WireClass): WireClass =>
  entry === ANIMAL ? without(ANIMAL, 'rideable') : entry,
)
/** A newer receiver: an `animal.mood` the sender has never heard of. */
const NEWER = LOCAL.map((entry: WireClass): WireClass =>
  entry === ANIMAL ? { ...ANIMAL, fields: [...ANIMAL.fields, MOOD] } : entry,
)
/** Where `rideable` sits in the sender's animal row. */
const RIDEABLE = ANIMAL.fields
  .filter((field: WireClassField): boolean => !('send' in field))
  .findIndex((field: WireClassField): boolean => field.name === 'rideable')

/** Every frame of one recording, decoded raw by the sender's columns. */
async function decoded(name: string): Promise<readonly Decoded[]> {
  const dir = new URL(`../bench/recordings/${name}/`, import.meta.url)
  const manifest: unknown = JSON.parse(
    await readFile(new URL('manifest.json', dir), 'utf8'),
  )
  const session = await readSessionArchive(
    manifest,
    async (file: string): Promise<Readonly<Uint8Array>> =>
      await readFile(new URL(file, dir)),
  )
  return session.frames.map((record): Decoded => {
    const { input, raw } = replay(record)
    assert.ok(raw)
    const ids = new Map(
      LOCAL.map((entry: WireClass): readonly [string, number] => [
        entry.name,
        entry.id,
      ]),
    )
    return {
      raw,
      classOf: (handle: number): number | undefined =>
        ids.get(input.classOf(handle)?.cls ?? ''),
    }
  })
}

/** An older receiver's animal row is the sender's without `rideable`. */
function checkOlderAnimal(
  slots: Parameters<typeof projectRow>[0],
  row: Readonly<Uint32Array>,
): void {
  const expected = [...row].filter(
    (_word: number, index: number): boolean => index !== RIDEABLE,
  )
  assert.deepEqual([...projectRow(slots, row)], expected)
}

/** An older receiver's projected animals, and the raw rows it can't show. */
async function olderReceiver(
  name: string,
): Promise<{ readonly animals: number; readonly hidden: number }> {
  const projections = projectClasses(LOCAL, OLDER)
  const counts = { animals: 0, hidden: 0 }
  for (const { raw, classOf } of await decoded(name)) {
    for (const [handle, row] of raw.rows) {
      const projection = projections.get(classOf(handle) ?? 0)
      counts.hidden += projection === undefined ? 1 : 0
      if (projection !== undefined && classOf(handle) === ANIMAL.id) {
        counts.animals += 1
        checkOlderAnimal(projection.row, row)
      }
    }
  }
  return counts
}

test('an older receiver drops a column and a class, and keeps known rows exact', async (): Promise<void> => {
  assert.equal(projectClasses(LOCAL, OLDER).has(3), false)
  const fight = await olderReceiver('fight')
  assert.ok(fight.animals > 100)
  // The ride recording carries encounter rows: held raw, shown nowhere, and
  // every animal row around them still exact.
  const ride = await olderReceiver('ride')
  assert.ok(ride.hidden > 100 && ride.animals > 100)
})

test('a newer receiver reads a field the sender lacks as its default', async (): Promise<void> => {
  const animal = projectClasses(LOCAL, NEWER).get(ANIMAL.id)
  assert.ok(animal)
  let seen = 0
  for (const { raw, classOf } of await decoded('fight')) {
    for (const [handle, row] of raw.rows) {
      if (classOf(handle) === ANIMAL.id) {
        seen += 1
        assert.deepEqual([...projectRow(animal.row, row)], [...row, 0])
      }
    }
  }
  assert.ok(seen > 100)
})

/** Each frame's owner block and ride words through one receiver's projection. */
function mountedFrames(
  frames: readonly Decoded[],
  local: readonly WireClass[],
): number {
  const player = projectClasses(LOCAL, local).get(PLAYER.id)
  const mount = projectRides(RIDE_LAWS, RIDE_LAWS).get(MOUNT.id)
  if (player === undefined || mount?.seated !== true) {
    throw new Error('Expected a player and a seated mount law')
  }
  for (const { raw } of frames) {
    assert.deepEqual([...projectRow(player.owner, raw.owner)], [...raw.owner])
    const words = raw.ride?.words ?? new Float64Array(0)
    assert.deepEqual(
      [...projectRow(mount.words, words)].slice(0, words.length),
      [...words],
    )
  }
  return frames.filter(
    (frame: Decoded): boolean => frame.raw.ride !== undefined,
  ).length
}

test('mounted play keeps every owner f64 bit and ride word, both ways', async (): Promise<void> => {
  const frames = await decoded('ride')
  assert.ok(mountedFrames(frames, OLDER) > 100)
  assert.ok(mountedFrames(frames, NEWER) > 100)
})

test('a sender lacking a required field refuses before play', (): void => {
  for (const name of ['x', 'px', 'vy']) {
    const sender = LOCAL.map((entry: WireClass): WireClass =>
      entry === PLAYER ? without(PLAYER, name) : entry,
    )
    assert.throws(
      (): unknown => projectClasses(sender, LOCAL),
      /lacks required/u,
    )
  }
  const plain = LOCAL.map((entry: WireClass): WireClass => without(entry, 'hp'))
  assert.doesNotThrow((): unknown => projectClasses(plain, LOCAL))
})
