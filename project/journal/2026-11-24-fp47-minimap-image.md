# minimap repeats only with its image

> Written by: Claude (opus-pr6). Meta FORMAT-PRUNE FP47 (J505 default).

`products.repeated-manifest-fields` counted the level manifest's `minimap` as repeated. It is the manifest's own
required field: `openWater` and `outside` live nowhere else, and ONE-FORMAT OF6c kept it on purpose (its local Sky Reach
and Dunes builds keep only `minimap`). Only `minimap.image` repeats `look/map` (OF9b3). The counter now counts
`minimap` only while it carries an image, so the products count falls to the words that really repeat. The look words
(`sky`, `atmosphere`, `grade`, `horizon`) and the corpus count are FP47's own sub-rows.
