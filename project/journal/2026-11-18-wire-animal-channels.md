# Wire 1.1: the animal's channels and lock answer

> Written by: Claude (opus-of-m5c), ONE-FORMAT CC28.

A creature's script can now move four actor channels (a jaw, a fade, a
glow) and turn its lock on or off. Both live on the server, and every page
must see them, so they are animal row fields 25 to 29: `channel1` to
`channel4` (UNIT_8, sent on spawn and as deltas) and `lockable`, an enum
of `row` (keep the species row's), `on` and `off`.

That is an appended row field, so a minor: WIRE_MINOR 1, package 1.1.0.
The old-client test went in first: the 1.0.0 codec (the tag, pinned so a
later release does not empty the test) plays a HEAD room and HEAD plays a
1.0.0 room. The harness used to want every room column but `mood` back in
order, which only held while both sides had the same animal; it now wants
each local column by id, with the default where the room lacks it.

Fixtures that took "today's lock" as minor 0 now normalise it to minor 0,
and the projection test's recordings are read as the wire they were
recorded with (animal fields up to 24).

The first push met the lint: the same tests, rewritten without a forEach
walk, an inner helper or a spread inside a map.
