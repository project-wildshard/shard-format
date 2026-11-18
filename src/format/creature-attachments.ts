// ONE-FORMAT CC30a: a body's socket attachments. Each hangs up to four parts on
// a skeleton socket the way the boss socket rig does (`bossSocketRig.ts`: an
// `{ id, geometry, material }` part), where `geometry` is a library GLB's hash
// and `material` a `look.materials` id. `when` shows it while a channel is at
// `at` or above; `part` hides it once that volume breaks (the volume's
// `channel`, set to 1 by the break, carries it to every page); `desktop`
// drops it on the phone tier.
import {
  array,
  boolean,
  check,
  exactOptional,
  finite,
  maxLength,
  maxValue,
  minLength,
  minValue,
  number,
  pipe,
  regex,
  strictObject,
  string,
  tuple,
} from 'valibot'

import { creatureContract } from './creature-skeletons.ts'
import { CreatureSocketNameSchema } from './creature-volumes.ts'
import { materialExists } from './materials.ts'

import type { CreatureSkeleton } from './creature-layers.ts'
import type { CreatureTrail } from './creature-skeletons.ts'
import type { GenericSchema } from 'valibot'

const ZERO = 0
const ONE = 1
const MAX_ATTACHMENTS = 8
const MAX_MESHES = 4
const MAX_ID = 128
const MAX_OFFSET = 500
const id = pipe(string(), regex(/^[a-z][a-zA-Z0-9.:-]*$/u), maxLength(MAX_ID))
const hash = pipe(string(), regex(/^[0-9a-f]{64}$/u))
const unit = pipe(number(), finite(), minValue(ZERO), maxValue(ONE))
const offset = pipe(
  number(),
  finite(),
  minValue(-MAX_OFFSET),
  maxValue(MAX_OFFSET),
)

/** One drawn part: a library GLB's geometry under a `look.materials` material. */
interface CreatureAttachmentMesh {
  id: string
  geometry: string
  material: string
}
interface CreatureAttachment {
  id: string
  /** A socket of the body's skeleton contract, or a bone of a GLB's own rig. */
  socket: string
  meshes: CreatureAttachmentMesh[]
  /** Offset in the socket's local frame. */
  at?: [number, number, number]
  /** Shown while `channel` is at `at` (0.5 when omitted) or above. */
  when?: { channel: string; at?: number }
  /** A body volume with a break `channel`: the attachment hides once it breaks. */
  part?: string
  /** Dropped on the phone tier. */
  desktop?: boolean
}

const mesh = strictObject({ id, geometry: hash, material: id })
const shownWhen = strictObject({ channel: id, at: exactOptional(unit) })
const meshList = pipe(array(mesh), minLength(ONE), maxLength(MAX_MESHES))
const attachment = strictObject({
  id,
  socket: CreatureSocketNameSchema,
  meshes: meshList,
  at: exactOptional(tuple([offset, offset, offset])),
  when: exactOptional(shownWhen),
  part: exactOptional(CreatureSocketNameSchema),
  desktop: exactOptional(boolean()),
})
const CreatureAttachmentsSchema: GenericSchema<CreatureAttachment[]> = pipe(
  array(attachment),
  minLength(ONE),
  maxLength(MAX_ATTACHMENTS),
  check<CreatureAttachment[], 'Duplicate creature attachment'>(
    (rows: readonly AttachmentView[]): boolean => {
      const ids = rows.flatMap((row: AttachmentView): readonly string[] => [
        row.id,
        ...row.meshes.map((part: MeshView): string => part.id),
      ])
      return new Set(ids).size === ids.length
    },
    'Duplicate creature attachment',
  ),
)

/** A read-only view of an attachment, for the checks below. */
interface AttachmentView {
  readonly id: string
  readonly socket: string
  readonly meshes: readonly MeshView[]
  readonly when?: { readonly channel: string }
  readonly part?: string
}
interface MeshView {
  readonly id: string
  readonly geometry: string
  readonly material: string
}

interface AttachedBody {
  readonly skeleton?: CreatureSkeleton
  readonly trail?: CreatureTrail
  readonly channels?: readonly { readonly name: string }[]
  readonly volumes?: readonly {
    readonly part: string
    readonly hp?: number
    readonly channel?: string
  }[]
  readonly attachments?: readonly AttachmentView[]
}

/** A volume's break channel is declared and the volume has hp to break. */
function volumeChannelsDeclared(body: AttachedBody): boolean {
  const names = new Set(
    (body.channels ?? []).map(
      (row: { readonly name: string }): string => row.name,
    ),
  )
  return (body.volumes ?? []).every(
    (row: { readonly hp?: number; readonly channel?: string }): boolean =>
      row.channel === undefined ||
      (row.hp !== undefined && names.has(row.channel)),
  )
}

/** The sockets a declared skeleton offers; undefined for a GLB's own rig. */
function socketNames(body: AttachedBody): ReadonlySet<string> | undefined {
  if (body.skeleton === undefined) {
    return undefined
  }
  if (body.skeleton === 'serpent' && body.trail === undefined) {
    return new Set()
  }
  return new Set(
    Object.keys(
      creatureContract({
        skeleton: body.skeleton,
        ...(body.trail === undefined ? {} : { trail: body.trail }),
      }).sockets,
    ),
  )
}

/** Every attachment's socket, `when` channel and `part` volume resolve on its body. */
function attachmentsResolve(body: AttachedBody): boolean {
  const sockets = socketNames(body)
  const channels = new Set(
    (body.channels ?? []).map(
      (row: { readonly name: string }): string => row.name,
    ),
  )
  const broken = new Set(
    (body.volumes ?? [])
      .filter(
        (row: { readonly channel?: string }): boolean =>
          row.channel !== undefined,
      )
      .map((row: { readonly part: string }): string => row.part),
  )
  return (body.attachments ?? []).every(
    (row: AttachmentView): boolean =>
      (sockets === undefined || sockets.has(row.socket)) &&
      (row.when === undefined || channels.has(row.when.channel)) &&
      (row.part === undefined || broken.has(row.part)),
  )
}

/** Shardfile reference rules: each part draws a library GLB under a declared material. */
function attachmentFileRules(source: {
  readonly species: readonly {
    readonly body?: { readonly attachments?: readonly AttachmentView[] }
  }[]
  readonly files: readonly { readonly hash: string; readonly kind: string }[]
  readonly library: readonly string[]
  readonly materials: Readonly<Record<string, unknown>>
}): string[] {
  const glbs = new Set(
    source.files
      .filter((file: { readonly kind: string }): boolean => file.kind === 'glb')
      .map((file: { readonly hash: string }): string => file.hash),
  )
  const library = new Set(source.library)
  const meshes = source.species.flatMap(
    (row: {
      readonly body?: { readonly attachments?: readonly AttachmentView[] }
    }): readonly MeshView[] =>
      (row.body?.attachments ?? []).flatMap(
        (item: AttachmentView): readonly MeshView[] => item.meshes,
      ),
  )
  const errors: string[] = []
  if (
    meshes.some(
      (part: MeshView): boolean =>
        !glbs.has(part.geometry) || !library.has(part.geometry),
    )
  ) {
    errors.push('creature attachment geometry')
  }
  if (
    meshes.some(
      (part: MeshView): boolean =>
        !materialExists(source.materials, part.material),
    )
  ) {
    errors.push('creature attachment material')
  }
  return errors
}

export {
  CreatureAttachmentsSchema,
  MAX_ATTACHMENTS,
  attachmentFileRules,
  attachmentsResolve,
  volumeChannelsDeclared,
}
export type { CreatureAttachment, CreatureAttachmentMesh }
