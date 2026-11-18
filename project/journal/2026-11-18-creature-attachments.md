# Creature attachments (ONE-FORMAT CC30a)

> Written by: Claude

A body hangs parts on its sockets now, the same `{ id, geometry,
material }` part the boss socket rig uses, so the page can build both the
same way. Geometry is a library GLB hash rather than a pool part name: a
data shard already admits GLBs by hash (props, skins), and a per-body pool
would be a second way. A broken part travels as a body channel (the
volume's `channel`), which CC28 already puts on the wire, so hiding a
broken plate's attachment needs no new wire field.
