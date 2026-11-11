import assert from 'node:assert/strict'
import { test } from 'node:test'

import { selectCapabilities } from '../src/frame-record.ts'
import { projectRides } from '../src/projection.ts'
import { decodeRideLawTables, encodeRideLawTables } from '../src/ride-tables.ts'
import { MOUNT, RIDE_LAWS } from '../src/rides.ts'
import { refuses } from './helpers/codec.ts'

import type { WireArm } from '../src/grammar.ts'

// WR4: a ride law travels in the welcome and a receiver is seated only on
// an exact law; capabilities select their intersection and list what a
// client lacks (WR5's door refuses on that list, before play).

test('a ride law is seated only when the sender’s law is exactly the receiver’s', (): void => {
  const fewer: WireArm = { ...MOUNT, fields: MOUNT.fields.slice(0, 30) }
  assert.equal(projectRides(RIDE_LAWS, RIDE_LAWS).get(MOUNT.id)?.seated, true)
  assert.equal(projectRides([fewer], RIDE_LAWS).get(MOUNT.id)?.seated, false)
  assert.equal(projectRides(RIDE_LAWS, [fewer]).get(MOUNT.id)?.seated, false)
})

test('ride law tables round-trip, and a law of non-f32 words or an id past 255 refuses', (): void => {
  const laws = decodeRideLawTables(encodeRideLawTables(RIDE_LAWS))
  assert.deepEqual(
    laws.map((law: WireArm): number => law.fields.length),
    [38],
  )
  const wide: WireArm = { ...MOUNT, id: 256 }
  const bent: WireArm = {
    ...MOUNT,
    fields: [{ id: 1, name: 'feetX', node: { kind: 'uint', bits: 8 } }],
  }
  for (const law of [wide, bent]) {
    refuses((): unknown => decodeRideLawTables(encodeRideLawTables([law])))
  }
})

test('capabilities select the intersection and list a missing required one', (): void => {
  assert.deepEqual(selectCapabilities([1, 2, 3], [2, 3, 4], [2]), {
    selected: [2, 3],
    missing: [],
  })
  assert.deepEqual(selectCapabilities([1], [2, 3, 4], [2]), {
    selected: [],
    missing: [2],
  })
})
