# 2026-11-27 Mounted images charge as the phone file the cook makes (SF25)

SF5g charged a shard's library images as the KTX2 the cook makes, but the images the cook mounts (Nine's paint,
viewmodel, hdri, lab and ground layers) were still charged as decoded RGBA, and they are counted twice in the phone
chain: once in the content term and once in the texture term at 2.68x. Nine Dragon 0.0.12 (images only) was refused
at a 1.84 GB loading peak with 205 MB of mounted images charged that way. Engine's cook encodes every `/assets/`
PNG, JPEG or WebP mount on the 4x4 grid (`desktopKtx2`) unless its row keeps it an image or it is a phone copy, and the
phone pass cooks the ASTC 6x6 file a phone reads at 512 (a sky at its size, a ground layer's `#layer` twin at 1024).
The estimate now mirrors that rule exactly: an encoded mount charges its phone file, a phone copy of one nothing, and
anything the cook leaves raw (kept images, off-grid images, `/shardfiles/` blob mounts) its decoded RGBA as before.
Image files the cook leaves raw (off the grid: Nine's 804x1626 portrait) now charge decoded and RGBA too, where SF5g
had charged them as a cooked file; that raises six old pins by 5 to 19 MB, all far under both lines. Nine 0.0.12
becomes 1.19 GB loading, 0.81 GB playing.

v0.82.5 never reached npm: its corpus gate refused 24 stored originals with a stream-miss, because the runtime
library projection read image bytes to tell an off-grid image apart, and a streamed admission holds none. That
projection now reads no image bytes; the offline estimate keeps charging raw images through `rawImages`. 0.82.6 ships
the fix with a test whose asset map refuses every read.
