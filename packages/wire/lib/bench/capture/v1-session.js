import { encodeClassTables } from '../../src/class-tables.js';
import { WIRE_CLASSES } from '../../src/classes.js';
import { eventsDecoder, eventTables } from '../../src/event-stream.js';
import { actCodec, clientTables, commandsCodec } from '../../src/game.js';
import { encodeRideLawTables } from '../../src/ride-tables.js';
import { RIDE_LAWS } from '../../src/rides.js';
import { spawnColumns } from '../../src/spawn-columns.js';
import { columnsNamed } from './v1-frames.js';
// WB2: what both v1 peers hold once the handshake is done: the server's
// table blocks, the client's command and act codecs as the server compiles
// them, and the event decoder with its spawn columns. Compiled once, as a
// receiver compiles them once per peer table.
const TABLES = {
    classTables: encodeClassTables(WIRE_CLASSES),
    eventTables: eventTables(),
    rideLawTables: encodeRideLawTables(RIDE_LAWS),
};
const SERVER = {
    commands: commandsCodec(clientTables().commandTable),
    act: actCodec(clientTables().actTable),
};
const SPAWNS = spawnColumns((id) => {
    const found = WIRE_CLASSES.find((entry) => entry.id === id);
    return found === undefined ? undefined : columnsNamed(found.name);
});
const readEvents = eventsDecoder(eventTables(), SPAWNS);
export { readEvents, SERVER, SPAWNS, TABLES };
