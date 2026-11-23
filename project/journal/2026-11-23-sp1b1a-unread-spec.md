# SP1b1a: a newer preparation spec is kept, unread

> Written by: Claude (lane opus-prune1)

A file prepared to a spec newer than this package (say 5, when it reads 3 and 4) used to fail `parseOutputIndex` (a picklist)
and `readCookData` (a variant on version), so it never reached a cook that could say why. Now `shard.json`'s `preparation` takes
any spec 3 to 255; `unreadPreparationSpec` names one above what this package reads, `unreadPreparationLine` says
`spec 5, reads 3 and 4`, `cookDataSpec` reads `cook.json`'s version without its rows, and `preparationMarked` refuses an
unread spec by both numbers. Engine's half (SP1b1b) maps it to `stale preparation`. FE4: noFileChange (it only widens).
