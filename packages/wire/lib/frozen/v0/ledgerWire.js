import { bitsToFloat, floatToBits, NetDecodeError } from './bits.js';
const GRANT_KINDS = ['fact', 'coins', 'item'];
/** Write a receipt after its event id. */
export function writeLedger(writer, event) {
    writer.write(event.tick, 32);
    writer.write(event.serial, 32);
    writer.writeText(event.id);
    writer.write(GRANT_KINDS.indexOf(event.grant), 2);
    writer.writeText(event.name);
    writer.write(floatToBits(event.amount), 32);
    writer.writeBool(event.pending);
}
/** Read a receipt after its event id. */
export function readLedger(reader) {
    const tick = reader.read(32), serial = reader.read(32), id = reader.readText(), grant = GRANT_KINDS[reader.read(2)];
    if (grant === undefined)
        throw new NetDecodeError('Unknown grant');
    return { kind: 'ledger', tick, serial, id, grant, name: reader.readText(), amount: bitsToFloat(reader.read(32)), pending: reader.readBool() };
}
