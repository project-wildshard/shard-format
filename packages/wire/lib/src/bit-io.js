// WIRE-STABILITY 5.1: what a v1 codec writes to and reads from. A record body
// is bit-packed, big-endian within a byte, and padded to a byte with zero
// bits. Codecs see only these method shapes; bit-writer.ts and bit-reader.ts
// implement them, and frozen v0 keeps its own IO.
export {};
