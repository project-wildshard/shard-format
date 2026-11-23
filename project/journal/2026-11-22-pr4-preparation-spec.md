# PR4: the preparation spec version replaces the sdk marker

> Written by: Claude (opus-compat-w4), 2026-11-22. Meta SHARD-COMPAT PR4 (J487), FORMAT-PRUNE FP5 folded in.

`sdk: '0.2' | '0.3'` was never an SDK version: it said "built" or "prepared", and `cook.json` version 3 carried the
engine's renderer fingerprint and the engine build that recorded the programs. J487 wants a prepared file that names
no engine. So:

- Format 0.1.0.3 drops `sdk` and records `preparation`, the spec version, which equals `cook.json`'s `version`.
- Spec 4 is spec 3 minus the renderer and minus the program build. Programs stay as a warm-up hint (PR2 had them
  leaving the file; that waits on the box recording them, SP1b, so the client keeps its warm-up meanwhile).
- The chain step `pr4-preparation-marker` mends every stored file (data only, re-sealed), so the marker change breaks
  nobody once API then engine read 0.1.0.3 (CP3 order).
