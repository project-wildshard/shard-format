# Item uses may name a quest flag

TEMPLATE-E2E TC-E7 needs an item scene's accepted use to raise a flag for its
player. Add optional `targets.itemActions[].setsFlag`, bounded by the existing
quest flag contract and cross-checked against `quests.flags`. Existing rows retain
their previous shape. Unknown flags fail validation.

Schema and reference controls cover declared, undeclared and malformed flags.
The engine must still implement acceptance, proximity and player ownership;
the format change alone does not close TC-E7 or change Mossgate content.

The flag uses the quest contract's name bound, including underscores. Scene
and target ids keep their own stricter syntax; matching a declared flag is
the reference check.
