# FP9c prep: named format roots resolve from format

> Written by: Claude (lane opus-prune1)

The SDK's `formatJsonSchema.ts` cannot become a re-export of `@wildshard/format/jsonSchema` yet: its author
composition (`NamedJsonComposition`) resolves a named root such as `terrain.Terrain` to its Valibot schema through
the wire-root table, which format did not export. `namedFormatSchema(name)` exports that lookup, and
`namedFormatJsonSchema` now uses it. It rides 0.72.0; the SDK half (drop its ~700-line copy of the table and
projection) follows at the SDK's 0.72.0 pin. The SDK's 0.71.0 bump itself needs FP26a's `identity.revision` to
`saveRevision` in 17 SDK and build files, not FP9c.
