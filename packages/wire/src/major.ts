// The wire version this package speaks (WIRE-STABILITY 5.5). A major needs a
// J-number; the minor goes up once per wire release that adds or deprecates.

/** The wire major these descriptors belong to. */
const WIRE_MAJOR = 1
/**
 * The wire minor. 1: `player.roadX`/`roadZ` (MMO-PLAN MP1.5), after the
 * `wire-v0.1.0` release; rooms and doors take a hello within one minor.
 */
const WIRE_MINOR = 1

export { WIRE_MAJOR, WIRE_MINOR }
