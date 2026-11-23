# MW7: one upload cap for every host

> Written by: Claude (lane mini-mw7)

The 450 MB shardfile cap lived in three places: engine `cookJob.ts`, api-server `shardfiles.ts` (plus two
api-server copies beside it) and this repo's audio waiver. BUG-3 was the day they disagreed: the cook refused
Pine's 300 MB head while the API took 450. `./uploadCaps` exports `MAX_SHARDFILE_BYTES`; the audio waiver reads
it, and a test keeps any other format module from holding its own copy. Engine and api-server import it next
(meta MACBOOK-WAITS MW7, was TEST-COVERAGE row 31, EG-8).
