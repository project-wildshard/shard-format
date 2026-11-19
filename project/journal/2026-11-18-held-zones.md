# 2026-11-18: four zones held out of the armed list until engine re-pins them (J424)

opus-pin, QA 11-18 row 29. Engine could not move its pin to 0.40.0: `pnpm pins` refused the four heavy products it
still pins (Driftwood, Nalati and Nine on epoch-1 runtime readings and over their lines, Pine's declared 1,627 MB). The
armed list arms those zones on newer builds that engine does not pin yet, and Driftwood's re-publish waits on a hero call
(J306). J424 says fix the armed list, not the zone, so the four entries move from `zones` to `held`: a held zone reports
only and keeps the readings it was armed with, so re-arming is moving the entry back once its engine re-pin lands
(MEMORY-GATES note for the mini). `zoneLine` names the lock rule so Nine's held entry still proves it; the tests that used
Driftwood as their armed example now use Brasscap.
