# Admit frame recordings only after exact frozen replay

Opus required the actual per-handle rowFrom baselines and due() calls,
not only the global baseline and output bytes. FrameTrace records each
callback invocation and its exact result at encode time. It never
re-evaluates those callbacks later. Per-call source ticks/row words,
missing sources, false due results, visibility order, class bindings,
owner/ride IEEE bits and the real bytes survive the JSON boundary.

finish always replays frozen v0 before admitting the record. Missing,
extra or reordered callback reads refuse; any byte mismatch refuses.
There is no skip flag. Four actual-codec tests preserve stale sources,
false due and negative zero, and kill global-baseline and due-omission
mutants. A missing rowFrom source stays null, never global fallback.

An uncommitted tee on exact engine cfd6681 runs a real admitted Sunscar
headless room, NetClient, Rapier and 120 walking ticks. All61 real frames
replay byte-identically before entering the sink:930 actual rowFrom
calls,1590 due calls,13.897559m earned movement,0 dropped frames and
0 live sockets. This is capture integrity, not a WS3 benchmark pass.
The four full recordings and two-run CPU repeatability remain open.
Strict types/lint and59 package cases precede the normal full push.
