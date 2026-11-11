import type { WireEvent } from '../../src/game.ts'
import type { WireStruct, WireValue } from '../../src/values.ts'

// WB2: a captured v0 packet's decoded values, said the v1 way, so the same
// real traffic runs through the v1 codec. The differences are the redo's own
// (5.3): vectors become x, y, z structs, a presence flag becomes absence, a
// handle string becomes its handle, a class index becomes its stable id.

const PREFIX = 'captured-handle:'
const NONE = 0
/** Frozen v0 numbers classes from 0; v1 class ids start at 1 (5.2). */
const FIRST_CLASS_ID = 1
const LOW_BYTE = 256
const AXES = 3
const VECTORS = new Set(['at', 'dir'])

/** A captured handle string as its handle; absent stays absent. */
function handleOf(id: unknown): number | undefined {
  return typeof id === 'string' && id.startsWith(PREFIX)
    ? Number(id.slice(PREFIX.length))
    : undefined
}

/** A plain value: null reads as absent; a 3-vector as a struct. */
function plain(key: string, value: unknown): WireValue {
  if (value === null || value === undefined) {
    return undefined
  }
  if (Array.isArray(value) && VECTORS.has(key) && value.length === AXES) {
    const [east, up, north] = value as readonly number[]
    // oxlint-disable-next-line id-length -- the x, y, z axes (5.3)
    return { x: east, y: up, z: north }
  }
  if (Array.isArray(value)) {
    return value as readonly WireValue[]
  }
  if (typeof value === 'object') {
    // oxlint-disable-next-line no-use-before-define -- a value and its fields recurse
    return fields(value)
  }
  return typeof value === 'number' ||
    typeof value === 'string' ||
    typeof value === 'boolean'
    ? value
    : undefined
}

/** Every field but `kind` and `seq`, said plainly. */
function fields(
  value: object,
  skip: ReadonlySet<string> = new Set(),
): WireStruct {
  const out: Record<string, WireValue> = {}
  for (const [key, inner] of Object.entries(value)) {
    if (!skip.has(key)) {
      out[key] = plain(key, inner)
    }
  }
  return out
}

/** One v0 command as the v1 command struct. */
function v1Command(
  command: {
    readonly buttons: number
    readonly attack?: { readonly targetId?: string; readonly aim: object }
    readonly heavyTarget?: string
    readonly lockTarget?: string
    readonly launcher?: { readonly fire?: true }
  } & object,
): WireStruct {
  const { attack, launcher } = command
  return {
    ...fields(
      command,
      new Set(['buttons', 'attack', 'heavyTarget', 'lockTarget', 'launcher']),
    ),
    buttons: command.buttons % LOW_BYTE,
    buttonsHigh:
      command.buttons >= LOW_BYTE
        ? Math.floor(command.buttons / LOW_BYTE)
        : undefined,
    attack:
      attack === undefined
        ? undefined
        : { targetId: handleOf(attack.targetId), aim: fields(attack.aim) },
    heavyTarget: handleOf(command.heavyTarget),
    lockTarget: handleOf(command.lockTarget),
    hookTarget:
      'hookTarget' in command && typeof command.hookTarget === 'number'
        ? command.hookTarget
        : undefined,
    launcher:
      launcher === undefined
        ? undefined
        : { ...fields(launcher), fire: launcher.fire === true },
  }
}

/** One v0 act as the v1 act union's arm. */
function v1Act(
  act: { readonly kind: string; readonly seq: number } & object,
): WireStruct {
  return {
    seq: act.seq,
    act: { arm: act.kind, fields: fields(act, new Set(['kind', 'seq'])) },
  }
}

/** One v0 event as a v1 event. */
function v1Event(event: { readonly kind: string } & object): WireEvent {
  const out = fields(event, new Set(['kind']))
  if (event.kind === 'spawn') {
    const cls = typeof out['cls'] === 'number' ? out['cls'] : NONE
    return { event: 'spawn', fields: { ...out, cls: cls + FIRST_CLASS_ID } }
  }
  if (event.kind === 'hit') {
    return { event: 'hit', fields: { ...out, blow: out['blow'] === true } }
  }
  return { event: event.kind, fields: out }
}

export { v1Act, v1Command, v1Event }
