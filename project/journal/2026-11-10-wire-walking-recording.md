# Keep every byte of the real walking session

WS3 now has a portable, exact-commit-guarded walking runner and full
recording ready for review. The installer writes only the reviewed tee
in an owned scratch baseline; existing foreign source/helper edits
refuse. The runner requires its read-only preflight and all frozen frame
and packet byte oracles before writing a new output directory.

The recording is 901 frames, 2,706 packets and 206.034 m of real native
walking, including all 14,122 rowFrom sources, 16,498 due results,
80 deliberately lost command bundles and ten full recovery frames.
The frozen replay is exact and the client drops zero frames. No browser,
server, live socket, runtime codec, engine pin or secret is changed.

The actual repo cap is 1 MB, stricter than the plan's 5 MB file wording.
Lossless JSON array parts retain the full 4,474,982-byte canonical source
in six sub-1-MB files, 4,475,972 bytes with manifest. No cap was raised.
The reader verifies every part, ordering/range, total/source hash,
frame-to-transport reference and mandatory frozen replay before returning.
Eight explicit CI-only integration cases pass, initially seven in
1.14 s, max 444.55 ms,
with 9.5-second timeout and full-body elapsed checks. Independently
resealed corrupt frame and packet bytes still fail their actual oracle.

WS3 stays open: three scenario captures and both timing profiles remain.
This records no invented v1 gate or phone timing result.

J206 review found two installer MUST-FIXes. Both are fixed: cached index
and working-tree changes are checked, and both destinations must be
ordinary files under their real, contained parent directory. Untracked
baseline source also refuses. A real sparse Git fixture proves the old
installer accepts a staged room edit while the fixed one refuses. A real
symlink proves the old installer overwrites an outside target; the fixed
one refuses before touching its bytes. The committed manual proof has
bounded children, a 9.5-second complete elapsed check and own-root cleanup.
The SHOULD item is also fixed: a valid prefix-6 packet with its final bit
changed and both hashes resealed fails byte equality, not only dispatch.

Two fresh native captures produced seven literally identical data files.
Only the owned repeat files, mutation script and fixture were removed.
The full intended source recording and original scratch baseline remain.
Review: `~/.cache/wildshard/session-keep/reviews/ws3-recordings-shardfile-20261110-WS3-walking-archive-20261110T025329Z-59188.md`.

The manual proof also redirects the entire destination parent directory.
The old installer writes outside the checkout; the fixed installer
refuses the redirected parent before changing those outside bytes.
All three real Git/destination/parent controls finish under 9.5 seconds
and remove only the newly created fixture root.
