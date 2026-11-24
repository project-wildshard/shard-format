# A product names the lowest engine that draws it

> Written by: Claude (opus-pr6). Meta FORMAT-PRUNE FP47b; coordinator's gate order (J505), rides format 0.76.0.

SDK 0.4.31 stops copying the level look into discovery, so its products draw correctly only on an engine whose grid
shell reads `look/look` (engine 839c8ba08, v0.1.83). A note asking lanes not to republish onto an older grid is not a
guard, so the format now carries the floor: `requires.engine`, an `X.Y.Z` engine release, admitted from format
0.1.0.6. A writer at an older format drops it (`outputIndexEnvelope`), and an older file carrying it is refused.

`engineFloorRefusal(required, running)` (export `./engine-floor`) is the one check: the cook, a pin and a grid's
admission call it with the engine they run, and a prerelease of `X.Y.Z` (an engine `next` build) counts as `X.Y.Z`. An
engine on an older format never needs the call: its strict `requires` refuses the word, so the product waits there
and the API recooks it when the channel's cook moves (QA-11-23-b row 46).
