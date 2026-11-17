# Creature hit volumes

> Written by: Codex
> State: CC6a source, 2026-11-17.

ONE-FORMAT Q-CC18/19/20/41 needs authored hit parts, zero-damage
shields and tiny bodies that remain hittable. Body volumes replace
skeleton defaults by part; the resolved list has at most 16 entries.
Offsets are bone-local rest positions. Source radii stay authored;
the engine clamps the final scaled radius to 0.3 metres.

Optional fields retain absence and existing products. Lock names are
socket names, with multiple points and clip-hit sampling restricted
to giants. The runtime/importer resolves bone and socket existence
against the actual admitted rig. No new creature kind chooses law.
