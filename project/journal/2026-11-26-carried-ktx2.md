# A shardfile carries images only (SF15)

Lane opus-cookktx2, meta standalone shardfiles SF15 (J525). The cook now
makes every KTX2 from the shardfile's own images, so the format refuses a
new upload that carries its own KTX2 (a `ktx2` blob or a `.ktx2` file):
one way, never two. Stored shard files (pins, stored originals, the cook)
still read, so a zone keeps cooking until its re-pack. A cook mount row
can say `keepImage: true` for UI or pixel art the cook must leave alone.

The check sits after the inventory in both validators; in the stream one
it rides in replayPacksToInventory so that file keeps its 300-line cap.
