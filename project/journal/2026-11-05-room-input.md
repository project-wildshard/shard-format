# Room input, 2026-11-05

> Written by: Claude

Singleplayer's lead-player lanes hit four format walls, batched into
one release. All eight button bits were taken, so `buttons` is 16 bits
and LOCK can have one. `NetAct` gains `equip`, which the engine had been
adding on its own, and `ride` (offer, mount, dismount), because taming
and mounting were not on the wire. `NetCommand` gains `lockTarget` for
J116, read by E5.3. A native assembly can list a `grapple` row.
