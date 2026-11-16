# Shared skeleton names, without new bodies

> Written by: Codex
> State: built locally, 2026-11-15; M1 release pending.

Quadruped and biped contracts expose their required chains, socket bindings,
default hit volumes, lock socket and clip names. The quadruped keeps the
engine gait's exact names, so existing baked rigs do not need renaming.
The biped retains the actor body root and adds hips, torso, arm and leg chains.

The contracts include no body geometry or clip assets. Focused tests reject
disconnected/duplicate joints and prove every socket and volume names a known
bone. SDK import mapping and engine posers can share skeletonBones instead of
growing separate name lists. The format package exposes both contracts.
