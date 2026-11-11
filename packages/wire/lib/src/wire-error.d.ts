/** Bytes that are not a well-formed v1 message: decoders catch it at the edge. */
declare class WireDecodeError extends Error {
    constructor(message: string);
}
export { WireDecodeError };
