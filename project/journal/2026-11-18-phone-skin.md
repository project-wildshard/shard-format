# Phone skin on a skin look (ONE-FORMAT CC51b, format half)

> Written by: Claude (opus-of-m3m4)

A `platform.skin` look may now name `phone`, a second skin file the phone tier draws instead. It reuses the
variant table's contract check (skeleton, joints, clips, sockets, material) so the engine can pose it from the
same clips, and refuses a phone skin heavier than the desktop one. Variants plus a phone skin refuse for now:
a phone mesh per variant is a later step if a shard needs it. The engine half (draw it on the phone tier) and
the sharddev half (`creaturePhoneGlb` writes it) follow on the next format pin.
