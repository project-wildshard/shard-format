/** Bytes that are not a well-formed message. A decoder catches this at its boundary; it never reaches game code. */
export declare class NetDecodeError extends Error {
    constructor(message: string, options?: ErrorOptions);
}
/** A float32's IEEE bits, the unquantised form the owner block carries (§3.5). */
export declare function floatToBits(value: number): number;
/** The float32 those bits name. */
export declare function bitsToFloat(bits: number): number;
/** Strings on the wire are stable ids and spawn fields: never longer than an id's 128 chars in UTF-8. */
export declare const MAX_NET_TEXT_BYTES = 255;
/** Writes one message, then detaches it with `finish`. A writer is reused: nothing allocates per field. */
export declare class BitWriter {
    private bytes;
    private bit;
    constructor(capacity?: number);
    /** Bits written so far in this message. */
    get bitLength(): number;
    /** Write the low `bits` (1–32) of an unsigned integer. */
    write(value: number, bits: number): void;
    /** Write a double's IEEE bits (J140): a client and a server that must hold the same position hold the same bits. */
    writeDouble(value: number): void;
    /** Write one flag bit. */
    writeBool(value: boolean): void;
    /** Write a length-prefixed UTF-8 string of at most MAX_NET_TEXT_BYTES bytes. */
    writeText(text: string): void;
    /** Detach the finished message as its own transferable buffer and start the next one. */
    finish(): ArrayBuffer;
    private grow;
}
/** Cut text to fit `maxBytes` of UTF-8, at a whole character. */
export declare function fitText(text: string, maxBytes: number): string;
/** Reads one message. Every read past the end throws NetDecodeError, so untrusted lengths stay bounded. */
export declare class BitReader {
    private readonly bytes;
    private bit;
    constructor(bytes: Uint8Array);
    /** Bits not yet read. */
    get remaining(): number;
    /** Read `bits` (1–32) as an unsigned integer. */
    read(bits: number): number;
    /** Read a double, bit for bit. */
    readDouble(): number;
    /** Read one flag bit. */
    readBool(): boolean;
    /** Read a length-prefixed UTF-8 string. */
    readText(): string;
    /** Refuse trailing bytes: a well-formed message ends in the byte its last bit falls in. */
    end(): void;
}
