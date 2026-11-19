# Look level (ONE-FORMAT OF9b2)

- 2026-11-19, opus-of9b2: the manifest's `sky`, `atmosphere`, `grade`
  and `horizon` get a home in the look section, `look.level`, with the
  same schemas (read off `ManifestMetadataSchema.entries`, so the two
  can never drift) and the same units. A value moves byte for byte, so
  a shard built on it looks exactly as before.
- The manifest keeps the four as optional fields for a product built
  before OF9b2. `levelLook` reads the look first and lifts an older
  manifest's at the door; `liftLevelLook` moves them across.
- `lookLevelRules`: a shard with a manifest has a whole level look,
  in `look.level` or the manifest, never both.
- Why not new words (`look.light.sun`, a hemisphere row)? The engine's
  existing look words mean other things (`look.light.environment` is a
  sky-filtered ambient, not the IBL intensity; `look.grade.saturation`
  is centred on 1 and feeds the grid frame), and the phone tier drops
  `look.grade.bloom` but not the manifest's bloom. Reusing them would
  move pixels; the row's bar is parity.
