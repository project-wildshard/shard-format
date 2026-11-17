# 2026-11-17: a steer driver's wind push

> Written by: Claude (opus-ss10f), SHARD-SOURCE SS-MS2a2

A steer driver may carry `wind: { toward: [x, z], push }`: the ground
direction the look's wind blows to and the m/s a full sail adds straight
downwind (0 to 20). It lowers after the rest pose as three more numbers,
the direction at unit length, so a vehicle without wind keeps its nine.

The sdk fills it from the scene's look wind times the part's `sail`
(SS-MS2a4), so the format holds numbers, never a reference to the look,
and the engine's sim stays deterministic on its own inputs.

`toward` is a pair rather than `{x, z}` so the format's id-length ratchet
holds; a zero pair is refused (`someItem` non-zero).
