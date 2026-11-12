# Template 2 stays small (TEMPLATE-E2E S2-4)

- `src/ci/template-2.test.ts` packs `corpus/handwritten` and fails over
  3,000,000 bytes packed, or any file over the hooks' 1 MiB blob cap. It
  prints the packed size and the largest file as a test diagnostic, so
  CI's `test:ci` log carries the number. Today 2,762,240 bytes packed;
  the largest file is a 781,568-byte GLB. Download time is smoke time.
