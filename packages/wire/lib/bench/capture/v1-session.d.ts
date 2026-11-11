declare const TABLES: {
    classTables: Uint8Array<ArrayBufferLike>;
    eventTables: Uint8Array<ArrayBufferLike>;
    rideLawTables: Uint8Array<ArrayBufferLike>;
};
declare const SERVER: {
    commands: import("../../src/game.ts").BodyCodec;
    act: import("../../src/game.ts").BodyCodec;
};
declare const SPAWNS: import("../../src/event-stream.ts").SpawnColumns;
declare const readEvents: (span: import("../../src/bit-io.ts").Span) => import("../../src/event-stream.ts").ReadEvents;
export { readEvents, SERVER, SPAWNS, TABLES };
