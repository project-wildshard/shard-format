import { expect, test } from 'vitest'

import {
  CREATURE_SKELETONS,
  MIN_VOLUME_RADIUS,
  skeletonBones,
} from './creature-skeletons.ts'

import type { SkeletonContract, SkeletonVolume } from './creature-skeletons.ts'

function verify(contract: Readonly<SkeletonContract>): void {
  const known = new Set([contract.root])
  for (const chain of Object.values(contract.chains)) {
    expect(known.has(chain.parent)).toBe(true)
    for (const bone of chain.bones) {
      expect(known.has(bone)).toBe(false)
      known.add(bone)
    }
  }
  expect(skeletonBones(contract)).toEqual([...known])
  for (const socket of Object.values(contract.sockets)) {
    expect(known.has(socket.bone)).toBe(true)
  }
  expect(contract.sockets[contract.lock]).toBeDefined()
}

test.each(Object.entries(CREATURE_SKELETONS))(
  '%s chains, sockets, lock and volumes form one connected contract',
  (_name: string, contract: Readonly<SkeletonContract>): void => {
    verify(contract)
    const bones = new Set(skeletonBones(contract))
    for (const volume of contract.volumes) {
      expect(bones.has(volume.bone)).toBe(true)
      expect(volume.radius).toBeGreaterThanOrEqual(MIN_VOLUME_RADIUS)
    }
    expect(contract.clips).toEqual([
      'idle',
      'walk',
      'run',
      'attack',
      'hit',
      'die',
    ])
  },
)

test('quadruped gait names and biped hand sockets stay stable', (): void => {
  expect(CREATURE_SKELETONS.quadruped.chains['front.L']?.bones).toEqual([
    'FL_shoulder',
    'FL_carpus',
    'FL_fetlock',
  ])
  expect(CREATURE_SKELETONS.quadruped.chains['back.R']?.bones).toEqual([
    'BR_hip',
    'BR_stifle',
    'BR_hock',
  ])
  expect(CREATURE_SKELETONS.biped.sockets['hand.R']?.bone).toBe('hand.R')
  expect(CREATURE_SKELETONS.biped.sockets['chest']?.bone).toBe('chest')
  expect(
    CREATURE_SKELETONS.biped.volumes.find(
      (volume: Readonly<SkeletonVolume>): boolean => volume.part === 'head',
    )?.multiplier,
  ).toBe(2)
})

test('the contract check rejects a disconnected chain and duplicate joint', (): void => {
  const quad = CREATURE_SKELETONS.quadruped
  expect((): void => {
    verify({
      ...quad,
      chains: { invalid: { parent: 'absent', bones: ['extra'] } },
    })
  }).toThrow()
  expect((): void => {
    verify({
      ...quad,
      chains: { duplicate: { parent: 'body', bones: ['body'] } },
    })
  }).toThrow()
})
