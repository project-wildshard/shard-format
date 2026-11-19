# A plain grapple mode carries its profile and hooks (ONE-FORMAT OF41c, format half)

- The native `grapple` host read three things the plain `state/modes` grapple row never carried: a profile file, a
  hooks file and a guard collider owner (engine `nativeAssemblyHosts.ts`). So the grapple primitive could switch on
  from a plain row but could not install from it.
- A grapple row may now carry `profile` (the native profile without its id and course mode, which are the row's own),
  `hooks` (1 to 64 anchors), `guard` and `rise`. Profile and hooks come together; guard and rise need the profile. A
  row with only timings parses byte-identical.
- `declaredGrappleProfile(row)` builds the native `GrappleProfile` from such a row, so the engine's declared path hands
  `installGrapple` the same profile the native file gave it. The clearance, cue, look, fact and headless schemas are now
  one set in `modes.ts`, which `GrappleProfileSchema` reuses.
