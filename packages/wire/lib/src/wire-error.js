/** Bytes that are not a well-formed v1 message: decoders catch it at the edge. */
class WireDecodeError extends Error {
    constructor(message) {
        super(message);
        this.name = 'WireDecodeError';
    }
}
export { WireDecodeError };
