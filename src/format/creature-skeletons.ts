import type { CreatureSkeleton } from './creature-layers.ts'

interface SkeletonChain {
  readonly parent: string
  readonly bones: readonly string[]
}
interface SkeletonSocket {
  readonly bone: string
  readonly at: readonly [number, number, number]
}
interface SkeletonVolume {
  readonly part: string
  readonly bone: string
  readonly shape: 'sphere' | 'capsule'
  readonly radius: number
  readonly halfLength: number
  readonly axis: 'y' | 'z'
  readonly multiplier: number
}
/** Bone names are wire-format names after the SDK's import mapping. */
interface SkeletonContract {
  readonly root: string
  readonly chains: Readonly<Record<string, SkeletonChain>>
  readonly sockets: Readonly<Record<string, SkeletonSocket>>
  readonly lock: string
  readonly volumes: readonly SkeletonVolume[]
  readonly clips: readonly string[]
}
const ZERO = 0
const ONE = 1
const HEAD_MULTIPLIER = 2
const BODY_RADIUS = 0.35
const BODY_HALF_LENGTH = 0.5
const MIN_VOLUME_RADIUS = 0.3
const MOUTH_FORWARD = 0.2
const SEAT_HEIGHT = 0.15
const ORIGIN: readonly [number, number, number] = [ZERO, ZERO, ZERO]
const CLIPS: readonly string[] = ['idle', 'walk', 'run', 'attack', 'hit', 'die']

function socket(bone: string): SkeletonSocket {
  return { bone, at: ORIGIN }
}
function bodyVolume(bone: string, axis: 'y' | 'z'): SkeletonVolume {
  return {
    part: 'body',
    bone,
    shape: 'capsule',
    radius: BODY_RADIUS,
    halfLength: BODY_HALF_LENGTH,
    axis,
    multiplier: ONE,
  }
}
const HEAD: SkeletonVolume = {
  part: 'head',
  bone: 'head',
  shape: 'sphere',
  radius: MIN_VOLUME_RADIUS,
  halfLength: ZERO,
  axis: 'y',
  multiplier: HEAD_MULTIPLIER,
}

/** The quadruped keeps today's engine gait names, including front/back leg joints. */
const QUADRUPED: SkeletonContract = {
  root: 'body',
  chains: {
    neck: { parent: 'body', bones: ['neck1', 'neck2', 'head'] },
    tail: { parent: 'body', bones: ['tail'] },
    'front.L': {
      parent: 'body',
      bones: ['FL_shoulder', 'FL_carpus', 'FL_fetlock'],
    },
    'front.R': {
      parent: 'body',
      bones: ['FR_shoulder', 'FR_carpus', 'FR_fetlock'],
    },
    'back.L': { parent: 'body', bones: ['BL_hip', 'BL_stifle', 'BL_hock'] },
    'back.R': { parent: 'body', bones: ['BR_hip', 'BR_stifle', 'BR_hock'] },
  },
  sockets: {
    head: socket('head'),
    chest: socket('body'),
    back: socket('body'),
    mouth: { bone: 'head', at: [ZERO, ZERO, MOUTH_FORWARD] },
    seat: { bone: 'body', at: [ZERO, SEAT_HEIGHT, ZERO] },
    tail: socket('tail'),
  },
  lock: 'chest',
  volumes: [bodyVolume('body', 'z'), HEAD],
  clips: CLIPS,
}
/** An identity body root retains the existing actor root contract. */
const BIPED: SkeletonContract = {
  root: 'body',
  chains: {
    spine: {
      parent: 'body',
      bones: ['hips', 'spine', 'chest', 'neck', 'head'],
    },
    'arm.L': { parent: 'chest', bones: ['upperArm.L', 'forearm.L', 'hand.L'] },
    'arm.R': { parent: 'chest', bones: ['upperArm.R', 'forearm.R', 'hand.R'] },
    'leg.L': { parent: 'hips', bones: ['thigh.L', 'shin.L', 'foot.L'] },
    'leg.R': { parent: 'hips', bones: ['thigh.R', 'shin.R', 'foot.R'] },
  },
  sockets: {
    head: socket('head'),
    chest: socket('chest'),
    back: socket('chest'),
    mouth: { bone: 'head', at: [ZERO, ZERO, MOUTH_FORWARD] },
    'hand.L': socket('hand.L'),
    'hand.R': socket('hand.R'),
  },
  lock: 'chest',
  volumes: [bodyVolume('chest', 'y'), HEAD],
  clips: CLIPS,
}
const CREATURE_SKELETONS: Readonly<Record<CreatureSkeleton, SkeletonContract>> =
  {
    quadruped: QUADRUPED,
    biped: BIPED,
  }

/** Importers and posers share this list, rather than inferring a creature kind. */
function skeletonBones(
  contract: Readonly<SkeletonContract>,
): readonly string[] {
  return [
    contract.root,
    ...Object.values(contract.chains).flatMap(
      (chain: Readonly<SkeletonChain>): readonly string[] => chain.bones,
    ),
  ]
}

export { CREATURE_SKELETONS, MIN_VOLUME_RADIUS, skeletonBones }
export type { SkeletonChain, SkeletonSocket, SkeletonVolume, SkeletonContract }
