# Room input, 2026-11-05

> Written by: Claude

Singleplayer's lead-player lanes hit four format walls, batched into
one release. All eight button bits were taken, so `buttons` is 16 bits
and LOCK can have one. `NetAct` gains `equip`, which the engine had been
adding on its own, and `ride` (offer, mount, dismount), because taming
and mounting were not on the wire. `NetCommand` gains `lockTarget` for
J116, read by E5.3. A native assembly can list a `grapple` row.

`boss.arena` joins the assembly features in v0.3.1, so a room fight
such as Nalati's King can run from the product. It names the page's
room file, the body, the reward and the door's world position.

## hookTarget (v0.3.2)

- A net client could only miss with the grapple: the server has no camera
  to pick a hook with, so `sim.lock(view, null, false)` found none. The
  command now says which hook, as J116 did for the lock-on target. Hooks
  are course rows with no id or handle, so it is an index, not a ref.
- The doc comment had LOCK as a hold. It toggles, so it is a press.
