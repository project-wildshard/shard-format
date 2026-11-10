import { WorldFrame } from '../../frozen/v0/frame.ts'
import { V0_CLASSES } from '../../frozen/v0/tables.ts'
import { packWords, unpackWords } from './frame-data.ts'

import type { NetClass } from '../../frozen/v0/schema.ts'
import type { Snapshot, CapturedRow } from './frame-data.ts'

interface FrameView {
  readonly tick: number
  readonly data: Readonly<Uint32Array>
  readonly offset: (handle: number) => number | undefined
}
interface ClassView {
  readonly id: number
  readonly row: readonly { readonly bits: number }[]
}
const CLASSES = new Map(
  V0_CLASSES.map(
    (entry: NetClass<never>): readonly [number, NetClass<never>] => [
      entry.id,
      entry,
    ],
  ),
)

function frozenClass(id: number): (typeof V0_CLASSES)[number] {
  const entry = CLASSES.get(id)
  if (entry === undefined) {
    throw new Error(`Class ${String(id)} is not in frozen v0`)
  }
  return entry
}

function snapshot(
  frame: FrameView,
  handles: readonly number[],
  classes: ReadonlyMap<number, number>,
): Snapshot {
  const rows: CapturedRow[] = []
  for (const handle of handles) {
    const at = frame.offset(handle)
    const id = classes.get(handle)
    if (id !== undefined && at !== undefined) {
      const end = at + frozenClass(id).row.length
      rows.push({
        handle,
        classId: id,
        words: packWords(frame.data.slice(at, end)),
      })
    }
  }
  return { tick: frame.tick, rows }
}

class CapturedWorld {
  private readonly frame = new WorldFrame()
  public read(data: Snapshot): WorldFrame {
    const { frame } = this
    frame.reset(data.tick)
    for (const row of data.rows) {
      const values = unpackWords(row.words)
      if (values.length !== frozenClass(row.classId).row.length) {
        throw new Error('Captured row width differs')
      }
      const offset = frame.claim(row.handle, values.length)
      frame.data.set(values, offset)
    }
    return frame
  }
}
function world(data: Snapshot): WorldFrame {
  return new CapturedWorld().read(data)
}

function missingBaseline(): null {
  // oxlint-disable-next-line unicorn/no-null -- Frozen FrameInput requires null for no baseline.
  return null
}

export {
  CapturedWorld,
  frozenClass,
  snapshot,
  world,
  missingBaseline,
  type FrameView,
  type ClassView,
}
