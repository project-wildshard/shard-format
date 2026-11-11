import assert from 'node:assert/strict'
import { test } from 'node:test'

import { selectCapabilities } from '../src/frame-record.ts'
import { projectRides } from '../src/projection.ts'
import { MOUNT, RIDE_LAWS } from '../src/rides.ts'

import type { WireArm } from '../src/grammar.ts'

// WR4: a ride law the receiver can't read whole never seats it, and a
// required capability the client lacks refuses before play.

test('a ride law the receiver cannot read whole never seats it', (): void => {
  const fewer: WireArm = { ...MOUNT, fields: MOUNT.fields.slice(0, 30) }
  assert.equal(projectRides(RIDE_LAWS, RIDE_LAWS).get(MOUNT.id)?.seated, true)
  assert.equal(projectRides([fewer], RIDE_LAWS).get(MOUNT.id)?.seated, false)
  // A receiver that knows fewer words than the sender still reads its own.
  const words = projectRides(RIDE_LAWS, [fewer]).get(MOUNT.id)
  assert.ok(words)
  assert.equal(words.seated, true)
  assert.equal(words.words.length, 30)
})

test('a required capability the client lacks refuses before play', (): void => {
  assert.deepEqual(selectCapabilities([1, 2, 3], [2, 3, 4], [2]), {
    selected: [2, 3],
    missing: [],
  })
  assert.deepEqual(selectCapabilities([1], [2, 3, 4], [2]), {
    selected: [],
    missing: [2],
  })
})
