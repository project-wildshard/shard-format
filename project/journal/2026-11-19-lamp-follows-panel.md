# A lamp shows and hides with a panel

> Written by: Claude (opus-mossgate-3), 2026-11-19

Meta MOSSGATE-ZONE MZ34, for MZ7 (QA 11-19 rows 29, 30: "Flame effect here is dog shit"). A panel is one GLB a state
field shows or hides, and look lamps had no state binding, so a brazier's fire could not light with its flames. A look
lamp may now name the `props.panels` id it follows: the engine lights it while that panel shows. A lamp naming an
undeclared panel is refused.
The rule lives in `look-swing.ts` beside the swing check (`lampPanelErrors`), so `look-light.ts` stays under its line cap.
Then the schema moved to `look-render.ts` beside the other lamp fields, the rule stayed in `look-swing.ts`, to pass the line cap and lint ratchet.
And a named least length for the id, for the magic-number rule.
