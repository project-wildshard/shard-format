// P1-E5.2 (E5-REPLICATION §4.2–4.3): the small messages around `frame` and `cmds`. Every message starts with its id byte.
import { CLIMATE_OPS } from './acts.js';
import { BitReader, bitsToFloat, floatToBits, NetDecodeError } from './bits.js';
import { readChat, writeChat } from './chatWire.js';
import { readLedger, writeLedger } from './ledgerWire.js';
export const MSG_HELLO = 1;
export const MSG_CMDS = 2;
export const MSG_ACT = 3;
export const MSG_WELCOME = 4;
export const MSG_FRAME = 5;
export const MSG_EVENTS = 6;
/** The id byte of any message, or 0 for an empty one. */
export function messageId(bytes) { return bytes[0] ?? 0; }
/** Run a decoder at the trust boundary: malformed bytes give null, never an exception. */
function guarded(bytes, id, read) {
    try {
        const reader = new BitReader(bytes);
        if (reader.read(8) !== id)
            return null;
        const out = read(reader);
        reader.end();
        return out;
    }
    catch (error) {
        if (error instanceof NetDecodeError)
            return null;
        throw error;
    }
}
export function encodeHello(writer, hello) {
    writer.write(MSG_HELLO, 8);
    writer.write(hello.schemaHash, 32);
    writer.writeText(hello.build);
    writer.writeText(hello.player);
    writer.writeText(hello.name);
    writer.write(hello.ledger, 32);
    return writer.finish();
}
export function decodeHello(bytes) {
    return guarded(bytes, MSG_HELLO, reader => ({ schemaHash: reader.read(32), build: reader.readText(), player: reader.readText(), name: reader.readText(), ledger: reader.read(32) }));
}
export function encodeWelcome(writer, welcome) {
    writer.write(MSG_WELCOME, 8);
    writer.write(welcome.handle, 16);
    writer.writeText(welcome.player);
    writer.write(welcome.tick, 32);
    writer.write(welcome.cell, 16);
    writer.write(welcome.schemaHash, 32);
    writer.write(welcome.simHz, 8);
    writer.write(welcome.frameHz, 8);
    return writer.finish();
}
export function decodeWelcome(bytes) {
    return guarded(bytes, MSG_WELCOME, reader => ({ handle: reader.read(16), player: reader.readText(), tick: reader.read(32), cell: reader.read(16), schemaHash: reader.read(32), simHz: reader.read(8), frameHz: reader.read(8) }));
}
/** The events' and commands' wire form, in NET_SCHEMA_HASH: a change here must refuse a stale client like a field table's does (J54). */
export const NET_EVENT_FORMS = 'view:s,u8,f32n;hit:h16,f32,p48,b,b,b,u16;died:h16,h16,d24,f32;player-died:h16,b,b,?s,?s,b,?s;quest:s,b,b,s,u16;phase:s,b;reward:u32,h16,b,?s;travel:u16,u16;ledger:u32,u32,s,u2,s,f32,b;chat:u32,u32,b,h16,s,s;buttons:u8,b,u8;lockTarget:h16;hookTarget:u16;ride:u8;fresh:b;mount:h16,h16,u16;dismount:h16,h16,u16;rideWords:b,u8,f32;climate:b,s,f32;buy:u16;board:b,u16;wear:s;pose:s;owned:s,f32';
const EVENT_SPAWN = 1, EVENT_DESPAWN = 2, EVENT_HIT = 3, EVENT_DIED = 4, EVENT_QUEST = 5, EVENT_PHASE = 6, EVENT_REWARD = 7, EVENT_TRAVEL = 8, EVENT_LEDGER = 9, EVENT_CHAT = 10, EVENT_MOUNT = 11, EVENT_DISMOUNT = 12, EVENT_OWNED = 13, EVENT_VIEW = 14, EVENT_PLAYER_DIED = 15;
/** Cell-local metres, as a field table declares them (§3.5). */
const METRES = 260, METRE_TOP = 0xffff, UNIT_TOP = 0xff;
const clampTo = (value, limit) => Math.max(-limit, Math.min(limit, value));
function writeScaled(writer, value, limit, bits, top) { writer.write(Math.round((clampTo(value, limit) + limit) / (2 * limit) * top), bits); }
const readScaled = (reader, limit, bits, top) => reader.read(bits) / top * 2 * limit - limit;
const writeVector = (writer, value, limit, bits, top) => { for (const axis of value)
    writeScaled(writer, axis, limit, bits, top); };
const readVector = (reader, limit, bits, top) => [readScaled(reader, limit, bits, top), readScaled(reader, limit, bits, top), readScaled(reader, limit, bits, top)];
function writeCombat(writer, event) {
    if (event.kind === 'reward') {
        writer.write(EVENT_REWARD, 8);
        writer.write(event.tick, 32);
        writer.write(event.coins, 32);
        writer.write(event.body, 16);
        writer.writeBool(event.item !== undefined);
        if (event.item !== undefined)
            writer.writeText(event.item);
        return;
    }
    writer.write(event.kind === 'hit' ? EVENT_HIT : EVENT_DIED, 8);
    writer.write(event.tick, 32);
    if (event.kind === 'hit') {
        writer.write(event.target, 16);
        writer.write(floatToBits(event.amount), 32);
        writeVector(writer, event.at, METRES, 16, METRE_TOP);
        writer.writeBool(event.head);
        writer.writeBool(event.killed);
        writer.writeBool(event.blow === true);
        writer.write(event.confirmFor, 16);
    }
    else {
        writer.write(event.id, 16);
        writer.write(event.by, 16);
        writeVector(writer, event.dir, 1, 8, UNIT_TOP);
        writer.write(floatToBits(event.impulse), 32);
    }
}
function readHit(reader) {
    const tick = reader.read(32), target = reader.read(16), amount = bitsToFloat(reader.read(32)), at = readVector(reader, METRES, 16, METRE_TOP), head = reader.readBool(), killed = reader.readBool(), blow = reader.readBool(), confirmFor = reader.read(16);
    return { kind: 'hit', tick, target, amount, at, head, killed, confirmFor, ...(blow ? { blow } : {}) };
}
function readDied(reader) {
    return { kind: 'died', tick: reader.read(32), id: reader.read(16), by: reader.read(16), dir: readVector(reader, 1, 8, UNIT_TOP), impulse: bitsToFloat(reader.read(32)) };
}
/** Encode an `events` message; `bits` gives the spawn fields' declared widths. */
export function encodeEvents(writer, tick, events, bits) {
    writer.write(MSG_EVENTS, 8);
    writer.write(tick, 32);
    writer.write(events.length, 16);
    for (const event of events) {
        if (event.kind === 'despawn') {
            writer.write(EVENT_DESPAWN, 8);
            writer.write(event.handle, 16);
            continue;
        }
        if (event.kind === 'hit' || event.kind === 'died' || event.kind === 'reward') {
            writeCombat(writer, event);
            continue;
        }
        if (event.kind === 'player-died') {
            writer.write(EVENT_PLAYER_DIED, 8);
            writer.write(event.tick, 32);
            writer.write(event.id, 16);
            writer.writeBool(event.checkpoint);
            writer.writeBool(event.cause !== undefined);
            if (event.cause !== undefined) {
                writer.writeText(event.cause.kind);
                writer.writeText(event.cause.label);
                writer.writeBool(event.cause.text !== undefined);
                if (event.cause.text !== undefined)
                    writer.writeText(event.cause.text);
            }
            continue;
        }
        if (event.kind === 'ledger') {
            writer.write(EVENT_LEDGER, 8);
            writeLedger(writer, event);
            continue;
        }
        if (event.kind === 'chat') {
            writer.write(EVENT_CHAT, 8);
            writeChat(writer, event);
            continue;
        }
        if (event.kind === 'mount' || event.kind === 'dismount') {
            writer.write(event.kind === 'mount' ? EVENT_MOUNT : EVENT_DISMOUNT, 8);
            writer.write(event.tick, 32);
            writer.write(event.rider, 16);
            writer.write(event.mount, 16);
            writer.write(event.seq, 16);
            continue;
        }
        if (event.kind === 'view') {
            writer.write(EVENT_VIEW, 8);
            writer.write(event.tick, 32);
            writer.writeText(event.name);
            writer.write(event.args.length, 8);
            for (const arg of event.args)
                writer.write(floatToBits(arg), 32);
            continue;
        }
        if (event.kind === 'owned') {
            writer.write(EVENT_OWNED, 8);
            writer.write(event.tick, 32);
            writer.writeText(event.name);
            writer.write(floatToBits(event.value), 32);
            continue;
        }
        if (event.kind === 'travel') {
            writer.write(EVENT_TRAVEL, 8);
            writer.write(event.tick, 32);
            writer.write(event.from, 16);
            writer.write(event.to, 16);
            continue;
        }
        if (event.kind === 'phase') {
            writer.write(EVENT_PHASE, 8);
            writer.write(event.tick, 32);
            writer.writeText(event.flag);
            writer.writeBool(event.on);
            continue;
        }
        if (event.kind === 'quest') {
            writer.write(EVENT_QUEST, 8);
            writer.write(event.tick, 32);
            writer.writeText(event.quest);
            writer.writeBool(event.started);
            writer.writeBool(event.step !== null);
            writer.writeText(event.step ?? '');
            writer.write(event.n, 16);
            continue;
        }
        writer.write(EVENT_SPAWN, 8);
        writer.write(event.handle, 16);
        writer.write(event.cls, 8);
        writer.writeText(event.id);
        bits(event.cls)?.bits.forEach((width, index) => { writer.write(event.initial[index] ?? 0, width); });
        for (const text of event.text)
            writer.writeText(text);
    }
    return writer.finish();
}
/** Decode an `events` message. An unknown class or event kind refuses the whole message. */
export function decodeEvents(bytes, bits) {
    return guarded(bytes, MSG_EVENTS, reader => {
        const tick = reader.read(32), count = reader.read(16), events = [];
        for (let index = 0; index < count; index++) {
            const kind = reader.read(8);
            if (kind === EVENT_DESPAWN) {
                events.push({ kind: 'despawn', handle: reader.read(16) });
                continue;
            }
            if (kind === EVENT_HIT) {
                events.push(readHit(reader));
                continue;
            }
            if (kind === EVENT_DIED) {
                events.push(readDied(reader));
                continue;
            }
            if (kind === EVENT_PLAYER_DIED) {
                const at = reader.read(32), id = reader.read(16), checkpoint = reader.readBool();
                let cause;
                if (reader.readBool()) {
                    const name = reader.readText(), label = reader.readText();
                    cause = { kind: name, label, ...(reader.readBool() ? { text: reader.readText() } : {}) };
                }
                events.push({ kind: 'player-died', tick: at, id, checkpoint, ...(cause === undefined ? {} : { cause }) });
                continue;
            }
            if (kind === EVENT_REWARD) {
                const at = reader.read(32), coins = reader.read(32), body = reader.read(16), item = reader.readBool() ? reader.readText() : undefined;
                events.push({ kind: 'reward', tick: at, coins, body, ...(item === undefined ? {} : { item }) });
                continue;
            }
            if (kind === EVENT_LEDGER) {
                events.push(readLedger(reader));
                continue;
            }
            if (kind === EVENT_CHAT) {
                events.push(readChat(reader));
                continue;
            }
            if (kind === EVENT_MOUNT || kind === EVENT_DISMOUNT) {
                events.push({ kind: kind === EVENT_MOUNT ? 'mount' : 'dismount', tick: reader.read(32), rider: reader.read(16), mount: reader.read(16), seq: reader.read(16) });
                continue;
            }
            if (kind === EVENT_VIEW) {
                const at = reader.read(32), name = reader.readText(), args = Array.from({ length: reader.read(8) }, () => bitsToFloat(reader.read(32)));
                events.push({ kind: 'view', tick: at, name, args });
                continue;
            }
            if (kind === EVENT_OWNED) {
                const at = reader.read(32), name = reader.readText();
                events.push({ kind: 'owned', tick: at, name, value: bitsToFloat(reader.read(32)) });
                continue;
            }
            if (kind === EVENT_TRAVEL) {
                events.push({ kind: 'travel', tick: reader.read(32), from: reader.read(16), to: reader.read(16) });
                continue;
            }
            if (kind === EVENT_PHASE) {
                const at = reader.read(32), flag = reader.readText();
                events.push({ kind: 'phase', tick: at, flag, on: reader.readBool() });
                continue;
            }
            if (kind === EVENT_QUEST) {
                const at = reader.read(32), quest = reader.readText(), started = reader.readBool(), held = reader.readBool(), step = reader.readText();
                events.push({ kind: 'quest', tick: at, quest, started, step: held ? step : null, n: reader.read(16) });
                continue;
            }
            if (kind !== EVENT_SPAWN)
                throw new NetDecodeError('Unknown event');
            const handle = reader.read(16), cls = reader.read(8), id = reader.readText(), widths = bits(cls);
            if (widths === undefined)
                throw new NetDecodeError('Unknown class');
            const initial = widths.bits.map(width => reader.read(width)), text = Array.from({ length: widths.text }, () => reader.readText());
            events.push({ kind: 'spawn', handle, cls, id, initial, text });
        }
        return { tick, events };
    });
}
const ACT_INTERACT = 1, ACT_RELOAD = 2, ACT_EQUIP = 3, ACT_CHAT = 4, ACT_REPORT = 5, ACT_RIDE = 6, ACT_CLIMATE = 7, ACT_BUY = 8, ACT_BOARD = 9, ACT_WEAR = 10, ACT_POSE = 11;
/** The ride acts, by their wire index. */
const RIDE_ACTIONS = ['offer', 'mount', 'dismount'];
/** Encode an `act` message. */
export function encodeAct(writer, act) {
    writer.write(MSG_ACT, 8);
    writer.write(act.seq, 16);
    if (act.kind === 'interact') {
        writer.write(ACT_INTERACT, 8);
        writer.writeText(act.id);
    }
    else if (act.kind === 'reload') {
        writer.write(ACT_RELOAD, 8);
        writer.write(act.slot, 8);
    }
    else if (act.kind === 'equip') {
        writer.write(ACT_EQUIP, 8);
        writer.write(act.slot, 8);
    }
    else if (act.kind === 'ride') {
        writer.write(ACT_RIDE, 8);
        writer.write(RIDE_ACTIONS.indexOf(act.action), 8);
    }
    else if (act.kind === 'wear') {
        writer.write(ACT_WEAR, 8);
        writer.writeText(act.id);
    }
    else if (act.kind === 'board') {
        writer.write(ACT_BOARD, 8);
        writer.writeBool(act.op === 'tear');
        writer.write(act.slot, 16);
    }
    else if (act.kind === 'buy') {
        writer.write(ACT_BUY, 8);
        writer.write(act.good, 16);
    }
    else if (act.kind === 'pose') {
        writer.write(ACT_POSE, 8);
        writer.writeText(act.names);
    }
    else if (act.kind === 'climate') {
        writer.write(ACT_CLIMATE, 8);
        writer.write(CLIMATE_OPS.indexOf(act.op), 8);
        writer.writeText(act.name);
        writer.write(floatToBits(act.at), 32);
    }
    else if (act.kind === 'chat') {
        writer.write(ACT_CHAT, 8);
        writer.writeBool(act.channel === 'proximity');
        writer.writeText(act.text);
    }
    else {
        writer.write(ACT_REPORT, 8);
        writer.write(act.line, 32);
    }
    return writer.finish();
}
/** Decode an `act` message. */
export function decodeAct(bytes) {
    return guarded(bytes, MSG_ACT, (reader) => {
        const seq = reader.read(16), kind = reader.read(8);
        if (kind === ACT_INTERACT)
            return { kind: 'interact', seq, id: reader.readText() };
        if (kind === ACT_RELOAD)
            return { kind: 'reload', seq, slot: reader.read(8) };
        if (kind === ACT_EQUIP)
            return { kind: 'equip', seq, slot: reader.read(8) };
        if (kind === ACT_RIDE) {
            const action = RIDE_ACTIONS[reader.read(8)];
            if (action === undefined)
                throw new NetDecodeError('Unknown ride act');
            return { kind: 'ride', seq, action };
        }
        if (kind === ACT_WEAR)
            return { kind: 'wear', seq, id: reader.readText() };
        if (kind === ACT_BOARD)
            return { kind: 'board', seq, op: reader.readBool() ? 'tear' : 'claim', slot: reader.read(16) };
        if (kind === ACT_BUY)
            return { kind: 'buy', seq, good: reader.read(16) };
        if (kind === ACT_POSE)
            return { kind: 'pose', seq, names: reader.readText() };
        if (kind === ACT_CLIMATE) {
            const op = CLIMATE_OPS[reader.read(8)];
            if (op === undefined)
                throw new NetDecodeError('Unknown climate act');
            return { kind: 'climate', seq, op, name: reader.readText(), at: bitsToFloat(reader.read(32)) };
        }
        if (kind === ACT_CHAT)
            return { kind: 'chat', seq, channel: reader.readBool() ? 'proximity' : 'room', text: reader.readText() };
        if (kind === ACT_REPORT)
            return { kind: 'report', seq, line: reader.read(32) };
        throw new NetDecodeError('Unknown act');
    });
}
