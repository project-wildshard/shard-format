# Required cook preparation

J198 overrides the old optional hint recommendation.
The source contract is written first in DOWNLOAD-THEN-C D5.
The old format explicitly accepts products with no cook pointer.
It also accepts version-1 cook data without any recorded lists.
That behavior remains the compatibility boundary for immutable heads.
It must not be called proof of J198 on those heads.

The new producer discriminator is sdk 0.3 in format 2.
It requires a measured cook.json pointer.
Cook version 2 requires mounts, fence, pack policy and GLSL programs.
All three list fields are mandatory even when their value is empty.
Programs are actual vertex/fragment pairs, not AssemblyScript programs.
Source lines and references have explicit bounds.
Invalid indexes and duplicate pairs refuse.
Duplicate fence hashes refuse.
Unknown fence hashes refuse at product admission.
The program table must equal its mounted canonical bytes.

The input digest binds the header except its own cook pointer.
It also binds every mount declaration.
That includes all source, section, file and pack metadata.
Changing any bound input requires preparation again.
The same reader runs at admission and is exported for cook.
The new metadata has an 8 MiB cap.
Legacy metadata is not silently rewritten.

The real CLI cases first failed on the unimplemented producer version.
Four outer-edge cases now validate and pack a prepared real product.
They refuse missing preparation, changed inputs and hostile list shapes.
The whole new proof runs in about 2.2 seconds.
It lives under src/ci and is not added to either hook.
The full existing format gate remains required before publication.

This commit does not activate a local workspace or deploy a game.
It does not claim the old 28 immutable heads have been regenerated.
Renderer provenance still needs an exact consumer/capture agreement.
That rollout remains named in D5 rather than hidden by a fallback.
