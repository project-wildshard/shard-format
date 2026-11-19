# 2026-11-19: Template 2 leaves the corpus

> Written by: Claude

J434 retired the legacy Template and Template 2; Mossgate Hollow and
Brasscap are the templates. `corpus/handwritten` (Template 2) and its
`src/ci/template-2.test.ts` are deleted, and the published `files` stop
listing it. The tests that read it now read `corpus/exports/brasscap-mesa`
(meta TEMPLATE-E2E TR-10).

Brasscap lacks three things the old folder had, so six format tests got a
purpose-built piece instead of being dropped: `feature-sides` adds its own
empty `client/plan` before planting the made-up kind; `grapple-declared`
seeds the claw's looks from Brasscap's `metal`, not Template 2's `door`;
`shardfile-stream` lists one pack of the first three sections (Brasscap
lists none) before swapping its members, and its binding mutation deletes
`Mesa`, which Brasscap's prop GLBs bind. Each still gives the refusal it
was written for (`pack-invalid`, `asset-admission`).
