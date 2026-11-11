import assert from 'node:assert/strict'
import { test } from 'node:test'

import { safeParse } from 'valibot'

import { NetActSchema, NetCommandSchema } from '../src/net-command.ts'

/* oxlint-disable id-length -- world axes are x, y and z on the wire */
const ORIGIN = { x: 0, y: 1, z: 2 }
const FORWARD = { x: 0, y: 0, z: 1 }
/* oxlint-enable id-length */
const COMMAND = {
  seq: 1,
  viewTick: 2,
  steer: { keyX: 1, keyY: -1, stickX: 0, stickY: 0 },
  yaw: 7,
  pitch: Math.PI / 2,
  buttons: 65_535,
  attack: { targetId: 'animal:1', aim: { origin: ORIGIN, direction: FORWARD } },
  launcher: { slot: 31, ads: 1, fire: true },
}

test('the moved command schema admits and refuses as format did', (): void => {
  assert.ok(safeParse(NetCommandSchema, COMMAND).success)
  for (const bad of [
    { ...COMMAND, buttons: 65_536 },
    { ...COMMAND, pitch: Math.PI / 2 + 0.01 },
    { ...COMMAND, heavyTarget: 'no spaces' },
    { ...COMMAND, launcher: { slot: 32, ads: 0 } },
    { ...COMMAND, extra: true },
  ]) {
    assert.ok(!safeParse(NetCommandSchema, bad).success)
  }
})

test('the moved act schema admits and refuses as format did', (): void => {
  const ride = { kind: 'ride', seq: 3, action: 'mount' }
  assert.ok(safeParse(NetActSchema, ride).success)
  assert.ok(!safeParse(NetActSchema, { ...ride, action: 'fly' }).success)
})
