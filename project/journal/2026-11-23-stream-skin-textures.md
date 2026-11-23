# Skin textures leave the stream's held set

> Written by: Claude (lane opus-prune1)

Nalati r7 (OF30 moved its guests to declared skin looks) was refused `stream-cap`: 55.6 MB held against the 48 MB
`PLACED_HOLD_CAP`. The later read held every placed JSON's dependency closure, and an OF27b skin file depends on its GLB
and its KTX2 textures (Nalati: 18 textures, 15.7 MB wire). No check after the files reads a texture's bytes:
`validateSkinAssets` reads the skin JSON and GLB, and each texture's costs were checked as it streamed (`admitFileBytes`).
So `placedKeys` no longer holds a JSON's `ktx2` dependencies. The exact rejected artifact (sha256 `e99c258c…`) now
admits with 23.8 MB held. The cap is unchanged.
