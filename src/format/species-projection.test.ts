import { expect, test } from "vitest";

import { jsonFixture } from "../test/helpers/perch-assets.ts";
import { parseRows } from "./rows.ts";

import type { ShardRows } from "./rows.ts";

// ONE-FORMAT OF30: a declared species may carry its view projection (Nalati's balbal guest).
const blob = {
  id: "fixture.blob",
  kind: "blob",
  label: "Blob",
  aggressive: false,
  lockable: true,
  dims: {
    bodyY: 0.4,
    bodyHalfLen: 0.4,
    bodyRadius: 0.4,
    headRadius: 0.2,
    legLen: 0.1,
    feet: [],
    halfWidth: 0.4,
  },
  variants: [
    {
      id: "grey",
      label: "Grey",
      rarity: "common",
      weight: 1,
      scale: [1, 1],
      hp: 10,
      mods: {
        speed: 1,
        chargeDist: 1,
        damageTaken: 1,
        chargeDamage: 0,
        relentless: false,
      },
    },
  ],
};
function rows(species: unknown): ShardRows {
  return parseRows({
    species: [species],
    weather: [],
    days: [],
    compendiums: [],
    loot: [],
    strikes: [],
    looks: [],
  });
}

test("OF30: a species row carries a projection program", (): void => {
  const projection = { program: jsonFixture("perch-projection") };
  expect(rows({ ...blob, projection }).species[0]?.projection?.program).toEqual(
    projection.program,
  );
});

test("OF30: a species without one parses byte-identical, and a bad one refuses", (): void => {
  expect(JSON.stringify(rows(blob).species[0])).toBe(JSON.stringify(blob));
  expect((): ShardRows =>
    rows({ ...blob, projection: { program: {} } }),
  ).toThrow();
});
