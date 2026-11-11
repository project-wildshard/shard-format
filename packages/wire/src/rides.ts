import type { WireArm } from './grammar.ts'

// WIRE-STABILITY 5.4: rides get a descriptor. A v0 frame carried the ride
// under the owner as untyped f32 words only the mount law read; v1 names the
// law by id and declares its words, so a client without that law's
// descriptor, or with a different one, keeps the block raw and is never
// seated. The mount law's 38 words are `MountedBody.captureRide`'s, in order
// (engine src/shared/game/riding/physics.ts); every word is an f32.

const MOUNT_WORDS = [
  'feetX',
  'feetY',
  'feetZ',
  'grounded',
  'heading',
  'speed',
  'yawRate',
  'vy',
  'steed',
  'winded',
  'breaking',
  'wUp',
  'cruise',
  'gallopWas',
  'jumpWas',
  'jumpQueued',
  'tapQueued',
  'clock',
  'lastPhase',
  'strideHz',
  'sectorWas',
  'skidT',
  'panicT',
  'panicRear',
  'panicYaw',
  'spurFlash',
  'spurStreak',
  'spurLatchT',
  'spurGood',
  'spurLastTap',
  'onDeck',
  'swimming',
  'airT',
  'blockedT',
  'shoveX',
  'shoveZ',
  'jostleCd',
  'gait',
] as const
const F32 = { kind: 'f32' } as const
const FIRST_ID = 1

/** The mount law: a ridden creature's flat motor state. */
const MOUNT: WireArm = {
  id: 1,
  name: 'mount',
  fields: MOUNT_WORDS.map(
    (name: string, at: number): WireArm['fields'][number] => ({
      id: at + FIRST_ID,
      name,
      node: F32,
    }),
  ),
}

/** Every ride law, by id. */
const RIDE_LAWS: readonly WireArm[] = [MOUNT]

export { MOUNT, RIDE_LAWS }
