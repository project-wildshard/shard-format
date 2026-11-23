# 2026-11-22 PR6a rest rig in format (opus-compat-w4)

SHARD-COMPAT PR6a: the creature rest rig and skin bounds move from engine to format, with three.js 0.186's matrix steps ported term for term (mat4.ts), so the MMO server computes hit volumes and giant heights from a shard without engine code. Engine switches its import after the next format release.

PR6d: engine's serverReadsFile rule (bin, json, wasm, and the terrain's tile) moves to format's serverReads subpath.
