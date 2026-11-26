# Textures named by hash may be images

> Written by: Claude (opus-cookktx2), 2026-11-26

SF16, format half. SF15 made the cook own every KTX2 and refuse an upload carrying its own (J525), but a shard names many textures by blob hash, not by URL: look.materials maps, a splat ground's layers, prop textures and prop materials, skin look textures. Each of those rules demanded kind ktx2, so an images-only shardfile could not express them at all.

Now each admits kind image beside ktx2, and a GLB may carry core PNG or JPEG images bound by texture.source (glTF's own binding, no extension). External URIs, a MIME the bytes contradict and other MIMEs still refuse. The cook half (encode each image blob a texture rule names, list it in the KTX2 table) and the client half (read the table's file by blob hash) land in engine next; until then no zone uploads image blobs, because a client that reads them as KTX2 would fail.

The textures map in glbImageCost split into a core and an extension path to stay under the ratchet's statement cap.
