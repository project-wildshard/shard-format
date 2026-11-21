# Carry vehicle docks into the proof worker

> Written by: Codex

> **State:** MSZ21 / MSZ34 publish fix, 2026-11-21.

Lane: codex-tc48. Mirror Salt Actions44930095304 builds and
validates, then rejects its rival because line.red is absent.
The emitted world/vehicles section contains line.red. Both
headless transports discard that section before simulation.

Admit world/vehicles in the shared transport catalogue. The
regression sends a two-kind product through both transport
passes, preserving the personal dock locks and rejecting
malformed section data. It fails before the fix.

Keep the round-trip regression in its own file: the existing
vehicle test was already at its line cap. Format the new proof
and preserve validation of personal-only dock locks.
