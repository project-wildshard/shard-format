# A commit reads a shard in bounded memory

> Written by: Claude

api-server's commit used 1.69 GB at 270 MB, and Pine is 464 MB once its art
is in. Two changes here serve that.

`indexTar` walks a tarball through a positional source, so a host can spool
the tarball to disk and read each file when format asks. `readTar` is now
that walk over bytes, with the same refusals.

`readThrough` stops format holding every admitted file for the checks at the
end: `assets` reads the file again on each `get`. Slower by repeat reads, but
the peak follows the largest file, not the shard. Real Pine (372 MB) peaks at
463 MB of RSS in 2.2 s.

A tarball may also leave `blobs/pack/` out. Every member already ships at its
own path, so that is 109 MB of Pine saved, and a validator rebuilds the pack
and checks its hash, so the bytes are still proved.

The read-through and pack helpers moved to `product-reads.ts`:
`validateShardfileProduct` sat at its size limit, and `packFromMembers` needs
an export of its own for whoever serves a product.

A mount may now name the listed blob it equals, so a shardfile holds a file
once however many URLs serve it: 47 MB of Pine sat there twice. `spawnManifest`
and the fence helpers left for singleplayer's cook (J22: packs never cross
repos).
