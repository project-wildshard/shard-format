/** Write a line after its event id. */
export function writeChat(writer, event) {
    writer.write(event.tick, 32);
    writer.write(event.line, 32);
    writer.writeBool(event.channel === 'proximity');
    writer.write(event.from, 16);
    writer.writeText(event.name);
    writer.writeText(event.text);
}
/** Read a line after its event id. */
export function readChat(reader) {
    return { kind: 'chat', tick: reader.read(32), line: reader.read(32), channel: reader.readBool() ? 'proximity' : 'room', from: reader.read(16), name: reader.readText(), text: reader.readText() };
}
