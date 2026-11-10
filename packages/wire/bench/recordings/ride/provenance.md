# Mounted Nalati recording

Exact engine cfd668102efcb7c10a6fb57d3021c1f3d23c37a5, actual admitted
Nalati product, native physics, mounted law, NetRoom and NetClient.
Run scripts/wire/capture-ride.mjs with the documented BASE/NEW_OUTPUT
arguments and exact-tee preflight. No live server or browser is opened.

The fixture initially places the player next to the actual available
camp horse creature:21. Thereafter real client acts mount at tick zero
and dismount at 230; production commands steer straight, then turn and
sprint. No horse adoption, mount flag, gait, speed or final pose is forced.
The actual body reports stand, walk and trot; final straight-line player
displacement is 2.4568939405166166 m, not a travelled-path measurement.

All 240 ticks (four simulated seconds), 121 frames and 486 packets remain.
115 frames carry actual ride words. The final frame is dismounted. Real
event bytes contain one mount and one dismount. Eighty upstream commands
are intentionally lost at 80 <= tick < 160; ten later full frames retain
missing-ACK recovery. Client drops zero frames; live sockets zero.

Canonical source: 2,056,489 bytes, SHA-256
16b14ca61208077d26e124a017b59ed49440416b34a626469a592524a8f4aace.
Parts plus manifest total 2,057,162 bytes, largest part 993,295 bytes.
All frozen per-handle sources, due decisions and transport bytes must
replay identically before a reader returns. Original caps stay intact.
This is a recording, not a timing or rendering pass. The dense scene and
Node/4x Chromium benchmark remain open.
