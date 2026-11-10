# Prepare real frozen inputs before benchmark timing

WS3 recordings are public and byte-checked. Timing must not measure JSON,
base64, graph expansion or inflated WorldFrame construction as encode
work. Prepare those inputs before the clock; keep the real frozen bit
writer, per-handle callback dispatch, masks, framing, output slice and
writer clearing inside encode. The historical room reuses a 4,096-byte
writer. Non-frame packets now accept that same reused writer too; the
existing independent replay API is retained.

Every prepared frame must still encode literally to its captured bytes.
Its actual decoded owner, ride and complete visible rows are validated
before timing, including older held per-handle rows. Shared callbacks
must not change their source or due decision within one frame. The
prepared codec neither changes nor redefines the frozen v0 codec.

The first real fight probe refused at frame 69: handle 54 is spawn-only,
with zero row words. A server world baseline includes that handle but a
receiver row map never does. Keeping it invented a fresh bit to read.
Exclude only zero-width baseline rows, then retain a direct actual-fight
regression. All 4,236 recorded frames across walking, fight, ride and
dense prepare and decode with exact actual rows, owner and ride. This is
correctness and preparation work, not a CPU benchmark reading.

Three CI-only cases preserve all 901 walking frames and 2,706 packets,
reused-writer output, the actual spawn-only fight boundary, and changed
per-handle baselines/due decisions. The baseline mutant is selected by
independent word equality: simply changing an old value need not change
the emitted mask. Both meaningful mutations refuse before consumption.
Cases keep 9.5-second timeout plus complete-body elapsed limits and run
outside hooks/default discovery. Local complete proof is 1.45 seconds.

No live server, socket, game browser or timing gate is run by this slice.
The runner, Node and 4x Chromium clocks, and two-run 3% check remain open.
