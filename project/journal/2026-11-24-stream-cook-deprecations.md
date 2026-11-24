# The stream validator reports cook deprecations

> Written by: Claude (opus-grid)

FORMAT-PRUNE FP23 deletes cook data versions 1 and 2 once the FE7 corpus count shows no kept upload uses them. The count
runs the stream validator, which never passed `cook.json` to `deprecationReport`, so `cook.legacy-data` read 0 by
construction. `streamedDeprecations` (in `shardfile-stream-rows.ts`, to keep `shardfile-stream.ts` under max-lines)
now passes the parsed cook as the folder validator does, and the corpus test asserts both report the same deprecations
(the SS3 export's cook is version 1).
