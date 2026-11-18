# The live Pine pin is reported, not refused (J424)

The Coordinator routed this one. `shardfile-stream-pins.test.ts` ("the
Pine revision 4 pin ... is refused over the J408 phone line by both
validators") has failed locally since 29250f9, which ratcheted Pine and
Nine at engine's full check. CI skips it because the pin file is absent
from its cache. opus-of-m3m4 pushed 6d23da9 with `SKIP_CHECK=1` (J381)
because of this test, and opus-flow's pushes stopped on it too.

J424 and J426 (350d01b) refuse a memory line only for a zone in
`memory-armed.json`. Pine is not armed, so both validators now admit the
pin. The test asserts that instead: both validators admit the pin, they
agree on the shard, and the offline estimate still reports the loading
line ("over the 1.5 GB phone line") as a warning. The live-pin case
moved to its own file, `shardfile-pine-live-pin.test.ts`, because one
more import would have pushed the pins file over its import cap. The two
older Pine pins keep their SS7 refusal where they were.

I first wrote a parallel per-zone `armed` field into
`memory-ratchet.ts`, then found 350d01b already on origin with the one
armed list. I dropped mine and kept only the test.
