# 2026-11-22 PR6a rest rig in format (opus-compat-w4)

SHARD-COMPAT PR6a: the creature rest rig and skin bounds move from engine to format, with three.js 0.186's matrix steps ported term for term (mat4.ts), so the MMO server computes hit volumes and giant heights from a shard without engine code. Engine switches its import after the next format release.

PR6d: engine's serverReadsFile rule (bin, json, wasm, and the terrain's tile) moves to format's serverReads subpath.

PR6c: engine's declaredPlayArea (manifest bounds under player.enter and world.runtime-hooks) moves to format's playArea subpath; it takes the plan's feature rows, not a folder.

PR6b: engine's vehicleHulls (steer vehicles' panel boxes turned into the vehicle's frame, three.js quaternion steps ported term for term; 2000 random vehicles match engine bit for bit, -0 included) and treadBoxes move to format.
