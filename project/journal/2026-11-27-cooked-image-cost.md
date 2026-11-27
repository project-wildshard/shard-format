# 2026-11-27 Images charge as the KTX2 the cook makes (SF5g)

Since J525 a shardfile carries images only and the cook encodes each texture image to the KTX2 a page reads. The memory
estimate still charged every image as source RGBA, decoded and on the GPU, so Pine Hollow 0.0.18 (same content as 0.0.17)
estimated a 1.67 GB phone loading peak and was refused at upload over the 1.5 GB line (J408); 0.0.17's hand-made KTX2 had
been 1.31 GB. Now an image charges what its cooked KTX2 charges: no decoded copy, a full mip chain on the GPU (RGBA, or
4x4 blocks with a transcode) in the library projection, and the cook's ASTC 6x6 phone file in the phone terms. Pine
0.0.18's phone estimate becomes 1.28 GB loading, 0.91 GB playing. Charged at full size: the cook trims most phone rows to
512, but a row holds no width to tell a ground layer or a sky (kept at size) apart, so the estimate stays conservative.
