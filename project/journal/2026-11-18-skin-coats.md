# 2026-11-18: a skin wears its maps and coat (ONE-FORMAT OF27b)

The hull-book look (base and normal maps, baked coats, the fur's sheen and backlit rim) becomes data a `platform.skin`
look can carry. A skin file's dependencies are its GLB, then its PBR material's textures (KTX2 or commons, sorted,
once each: `skinFileDependencies`), so the library closure loads them. A variant or phone skin may wear its own coat:
maps, sheen, rim and glow; everything else of the material stays shared. `pbr-fur.ts` adds the PBR family's `sheen`
(amount, linear colour, roughness) and `rim` (linear). No skin in the corpus named a texture before.
