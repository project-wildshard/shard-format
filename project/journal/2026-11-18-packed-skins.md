# 2026-11-18: a skin can draw one species of a packed GLB (meta ONE-FORMAT CC51c)

- A cell's pack step (sharddev) may put several small species in one GLB, each under its own node. Their joints,
  sockets and clips keep their plain names, so two species on the same kit skeleton share every name, and a skin row
  that reads the whole file finds two skinned meshes and refuses.
- A skin row's optional `rig.mesh` names its species' node: admission then reads only that subtree (its one skinned
  mesh, its joints and sockets) and only the clips whose every channel moves a node in it. Without `rig.mesh` a skin
  reads the whole file as before, so every existing skin keeps its meaning.
- `skin-packed.test.ts` packs the real Brasscap bandit GLB twice under `left` and `right`.
