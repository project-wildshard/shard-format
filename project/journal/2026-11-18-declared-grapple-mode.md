# A plain grapple mode carries its profile and hooks (ONE-FORMAT OF41c, format half)

- The native `grapple` host read three things the plain `state/modes` grapple row never carried: a profile file, a
  hooks file and a guard collider owner (engine `nativeAssemblyHosts.ts`). So the grapple primitive could switch on
  from a plain row but could not install from it.
- A grapple row may now carry `profile` (the native profile without its id and course mode, which are the row's own),
  `hooks` (1 to 64 anchors), `guard` and `rise`. Profile and hooks come together; guard and rise need the profile. A
  row with only timings parses byte-identical.
- The engine's declared path builds the native profile as `{ ...profile, id: row.id, course: { ...profile.course,
  mode } }` and checks it with `parseGrappleProfile`. The tool's sub-rows are spelled in `modes.ts` beside the native
  profile's own in `grapple.ts` (sharing them would have raised `src/format`'s lint ratchet on both files).
