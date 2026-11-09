/** Replay only the fixed WS2 fixture contexts, never a game simulation. */
declare function reencodeGolden(stream: string, bytes: Readonly<Uint8Array>): ArrayBuffer | undefined;
export { reencodeGolden };
