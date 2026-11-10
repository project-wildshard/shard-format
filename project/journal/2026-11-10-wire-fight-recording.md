# Keep both real clients in a command-heavy fight

WS3's second recording uses exact cfd, its real admitted Driftwood world
and native room/clients. Only the initial arena positions are fixtures.
The real crab AI keeps running and actual melee commands reduce 70 HP
to zero; no health, grant, quest flag or synthetic outcome is supplied.

Three hundred ticks produce 302 byte-identical frames, 928 packets,
twelve hit and two died notifications. Both clients receive real chat
and reward events. One hundred sixty upstream command packets are
intentionally lost, followed by twenty full recovery frames. Decoder
drops and live sockets remain zero. The complete canonical source is
3,363,856 bytes, kept in five sub-1-MB parts; no cap is raised.

The explicit CI reader case decodes the whole real transport mix, checks
both actual welcome identities, command/act/event counts, lost-ACK
recovery and the independent source hash. Every frame, per-handle source
and due call remains subject to the mandatory frozen byte oracle.
No rendering source, protocol codec, engine pin or hook test set changes.
Mounted/dense captures and both timing profiles remain open; no WS3
Progress tick or benchmark gate is claimed from these two recordings.

J206 review found no MUST-FIX. Its SHOULD is fixed: the CI case now
checks all 151 frames per client, excludes the current owner's welcome
handle and includes the other. Each tick in the exact loss window must
lose two upstream unreliable command packets, never another stream.
The review independently replayed all nine cases and verified the full
source hash and every stream. Report:
`~/.cache/wildshard/session-keep/reviews/ws3-recordings-shardfile-20261110-WS3-native-fight-20261110T033118Z-99751.md`.
