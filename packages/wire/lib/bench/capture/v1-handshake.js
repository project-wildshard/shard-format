import { clientTables } from '../../src/game.js';
import { decodeFirstMessage, decodeWelcome, encodeHello, encodeWelcome, tableHash, } from '../../src/handshake.js';
import { onlyRecord, packetOf } from './v1-packet.js';
import { TABLES } from './v1-session.js';
const HASH = tableHash([
    TABLES.classTables,
    TABLES.eventTables,
    TABLES.rideLawTables,
]);
const MINOR = 0;
/** A captured v0 hello as v1 work. */
function helloPacket(value) {
    const hello = {
        minor: MINOR,
        build: value.build,
        player: value.player,
        name: value.name,
        ledger: value.ledger,
        capabilities: [],
        ...clientTables(),
    };
    return packetOf('hello', {
        encode: () => encodeHello(hello),
        decode: (bytes) => decodeFirstMessage(bytes),
    });
}
/** A captured v0 welcome as v1 work, with the whole table set. */
function welcomePacket(value) {
    const welcome = {
        minor: MINOR,
        build: '',
        handle: value.handle,
        player: value.player,
        tick: value.tick,
        cell: value.cell,
        simHz: value.simHz,
        frameHz: value.frameHz,
        capabilities: [],
        requiredCapabilities: [],
        tableHash: HASH,
        tables: TABLES,
    };
    return packetOf('welcome', {
        encode: () => encodeWelcome(welcome),
        decode: (bytes) => decodeWelcome(onlyRecord(bytes)),
    });
}
export { helloPacket, welcomePacket };
