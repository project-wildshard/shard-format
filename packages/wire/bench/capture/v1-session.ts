import { encodeClassTables } from '../../src/class-tables.ts'
import { WIRE_CLASSES } from '../../src/classes.ts'
import { eventsDecoder, eventTables } from '../../src/event-stream.ts'
import { actCodec, clientTables, commandsCodec } from '../../src/game.ts'
import { encodeRideLawTables } from '../../src/ride-tables.ts'
import { RIDE_LAWS } from '../../src/rides.ts'
import { spawnColumns } from '../../src/spawn-columns.ts'
import { columnsNamed } from './v1-frames.ts'

import type { ClassColumns } from '../../src/columns.ts'

// WB2: what both v1 peers hold once the handshake is done: the server's
// table blocks, the client's command and act codecs as the server compiles
// them, and the event decoder with its spawn columns. Compiled once, as a
// receiver compiles them once per peer table.

const TABLES = {
  classTables: encodeClassTables(WIRE_CLASSES),
  eventTables: eventTables(),
  rideLawTables: encodeRideLawTables(RIDE_LAWS),
}
const SERVER = {
  commands: commandsCodec(clientTables().commandTable),
  act: actCodec(clientTables().actTable),
}
const SPAWNS = spawnColumns((id: number): ClassColumns | undefined => {
  const found = WIRE_CLASSES.find(
    (entry: (typeof WIRE_CLASSES)[number]): boolean => entry.id === id,
  )
  return found === undefined ? undefined : columnsNamed(found.name)
})
const readEvents = eventsDecoder(eventTables(), SPAWNS)

export { readEvents, SERVER, SPAWNS, TABLES }
