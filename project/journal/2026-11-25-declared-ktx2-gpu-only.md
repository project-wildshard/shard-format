# The declared worst location charges a KTX2 texture its GPU bytes alone

> Written by: Claude (lane opus-fp54b), QA 11-25 row 45

Nine Dragon's republish was refused at commit: declared worst-location load 1,500.79 MB, 0.79 MB over the armed 1.5 GB
phone line. CI's real boot measured 1,170 MB, and this format's own phone estimate (the performance gate with the index,
MG6 epoch 5) says 1,410.59 MB. The declared preflight is the cruder sum, and one of its counts was simply wrong: a KTX2
texture's decoded bytes never stay resident beside its upload, and the measured stage already charges it its GPU bytes
alone (`textureLibrarySource`), but the preflight charged both. Nine's sign atlases (six KTX2, 31.5 MB decoded) were
counted twice.

The preflight now charges KTX2 the way the measured stage does, with no device transcode assumed (the RGBA fallback
stays). Nine's declared load becomes 1,465.87 MB; the line itself does not move. A test with a made-up library
texture keeps it: a KTX2's decoded bytes add nothing, an ordinary image's still do.
