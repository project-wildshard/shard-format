import type { CreatureSkeleton } from './creature-layers.ts'

/** The skeletons whose bones never change with the body; a serpent's count comes from its `trail` row. */
type FixedSkeleton = Exclude<CreatureSkeleton, 'serpent'>

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
  /** Bones that follow the root's path, nearest first (CC23's serpent: every bone; CC58's horizontal biped: its tail). */
  readonly trail?: readonly string[]
  /** A forward pitch (radians about the bone's x axis) the poser gives one bone (CC58: a horizontal biped's spine). */
  readonly pitch?: { readonly bone: string; readonly angle: number }
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
const CREATURE_SKELETONS: Readonly<Record<FixedSkeleton, SkeletonContract>> = {
  quadruped: QUADRUPED,
  biped: BIPED,
}

/** A serpent's trail row (ONE-FORMAT CC23): `count` bones `spacing` metres apart along the root's path. */
interface CreatureTrail {
  readonly count: number
  readonly spacing: number
}
const SEGMENT_MULTIPLIER = 0.5
const SEGMENT_RADIUS = 0.6
const HALF = 2
/** Trail bone names, head first: `head`, `seg1` … `seg<count-2>`, `tail`. */
function trailBoneName(index: number, count: number): string {
  if (index === ZERO) {
    return 'head'
  }
  return index === count - ONE ? 'tail' : `seg${String(index)}`
}
function trailBoneNames(count: number): readonly string[] {
  return Array.from(
    { length: count },
    (_unused: unknown, index: number): string => trailBoneName(index, count),
  )
}
/**
 * The serpent (ONE-FORMAT CC23): every bone is a trail bone following the head's path, so the chain is the whole
 * body. Sockets `head`, `mouth`, `core` (the middle bone) and `tail`; one capsule per segment at x0.5 and the head
 * ball at x2. Buried segments' volumes are off (the engine's poser); the lock stays on the head.
 */
function serpentContract(trail: CreatureTrail): SkeletonContract {
  const bones = trailBoneNames(trail.count)
  const core = bones[Math.floor(trail.count / HALF)] ?? 'head'
  const segments = bones.slice(ONE).map((bone: string): SkeletonVolume => ({
    part: bone,
    bone,
    shape: 'capsule',
    radius: SEGMENT_RADIUS,
    halfLength: trail.spacing / HALF,
    axis: 'z',
    multiplier: SEGMENT_MULTIPLIER,
  }))
  return {
    root: 'head',
    chains: { spine: { parent: 'head', bones: bones.slice(ONE) } },
    sockets: {
      head: socket('head'),
      mouth: { bone: 'head', at: [ZERO, ZERO, MOUTH_FORWARD] },
      core: socket(core),
      tail: socket('tail'),
    },
    lock: 'head',
    volumes: [HEAD, ...segments],
    clips: CLIPS,
    trail: bones,
  }
}
/** A biped's stance (ONE-FORMAT CC58): `upright` is the plain biped; `horizontal` pitches the spine forward. */
type BipedStance = 'upright' | 'horizontal'
/** The horizontal biped's forward spine pitch: about 74 degrees, so the body leans out over the legs (Q-CC38). */
const HORIZONTAL_SPINE_PITCH = 1.3
const TAIL_MULTIPLIER = 0.5
/** A horizontal biped's tail bones, hips outward: `tail1` … `tail<count>`. */
function tailBoneNames(count: number): readonly string[] {
  return Array.from(
    { length: count },
    (_unused: unknown, index: number): string => `tail${String(index + ONE)}`,
  )
}
/**
 * The horizontal biped (ONE-FORMAT CC58, Q-CC38: the T-Rex): the biped contract with its spine pitched forward and a
 * `tail` chain off the hips whose `count` bones are trail bones, `spacing` metres apart along the path behind the hips.
 * One capsule a tail bone at x0.5; the tail tip is the `tail` socket (a sweep's origin).
 */
function horizontalBipedContract(trail: CreatureTrail): SkeletonContract {
  const tail = tailBoneNames(trail.count)
  const tip = tail.at(-ONE) ?? 'hips'
  return {
    ...BIPED,
    chains: { ...BIPED.chains, tail: { parent: 'hips', bones: tail } },
    sockets: { ...BIPED.sockets, tail: socket(tip) },
    volumes: [
      ...BIPED.volumes,
      ...tail.map((bone: string): SkeletonVolume => ({
        part: bone,
        bone,
        shape: 'capsule',
        radius: BODY_RADIUS,
        halfLength: trail.spacing / HALF,
        axis: 'z',
        multiplier: TAIL_MULTIPLIER,
      })),
    ],
    trail: tail,
    pitch: { bone: 'spine', angle: HORIZONTAL_SPINE_PITCH },
  }
}
/** The one contract a body declares: a fixed skeleton's, a serpent's built from its trail row, or a horizontal biped's. */
function creatureContract(body: {
  readonly skeleton: CreatureSkeleton
  readonly stance?: BipedStance
  readonly trail?: CreatureTrail
}): SkeletonContract {
  if (body.skeleton === 'biped' && body.stance === 'horizontal') {
    if (body.trail === undefined) {
      throw new Error('A horizontal biped needs its tail trail row')
    }
    return horizontalBipedContract(body.trail)
  }
  if (body.skeleton !== 'serpent') {
    return CREATURE_SKELETONS[body.skeleton]
  }
  if (body.trail === undefined) {
    throw new Error('A serpent needs its trail row')
  }
  return serpentContract(body.trail)
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

export {
  CREATURE_SKELETONS,
  HORIZONTAL_SPINE_PITCH,
  MIN_VOLUME_RADIUS,
  creatureContract,
  horizontalBipedContract,
  serpentContract,
  skeletonBones,
  tailBoneNames,
  trailBoneNames,
}
export type {
  BipedStance,
  CreatureTrail,
  FixedSkeleton,
  SkeletonChain,
  SkeletonSocket,
  SkeletonVolume,
  SkeletonContract,
}
