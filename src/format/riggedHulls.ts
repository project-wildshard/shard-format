/** A generator flap: the back plane z(y) = z0 + (y - y0) · slope; every vertex above `yMin` behind it is pressed onto it,
 *  keeping `keep` of its depth; `bulge` (m) rounds the pressed patch out into a dome (0 at its rim). */
export interface RiggedHullFlap {
  readonly yMin: number; readonly y0: number; readonly z0: number; readonly slope: number; readonly keep: number; readonly bulge: number;
}

/** A coat's fur sheen and backlit rim (sRGB 0..1) worn over its variant's own. */
export interface RiggedHullFur {
  readonly rim: readonly [number, number, number];
  readonly sheenColor: readonly [number, number, number];
}

/** A rigged-hull family as data. */
export interface RiggedHullFamilyRow {
  /** the log prefix (`[<label>] creature rig …`) */
  readonly label: string;
  /** every hull the family preloads, in order */
  readonly rigs: readonly string[];
  /** `kind:variant` → its hull; a variant missing here stays procedural */
  readonly hulls: Readonly<Record<string, string>>;
  /** per hull, the generator flap pressed onto its body */
  readonly flaps?: Readonly<Record<string, RiggedHullFlap>>;
  /** per hull, per variant id, the fur's sheen and rim */
  readonly fur?: Readonly<Record<string, Readonly<Record<string, RiggedHullFur>>>>;
}

/**
 * A hull's files as data (a built product's named-blob URLs for this tier): its image-free rig and its separate KTX2
 * maps, which the rig's material no longer carries. Both maps are sampled as the glTF maps they replace (`riggedHullMap`).
 */
export interface RiggedHullFiles {
  /** the image-free rigged GLB */
  readonly rig: string;
  /** the base colour map (KTX2, sampled sRGB) */
  readonly base: string;
  /** the tangent-space normal map (KTX2, in its file's own colour space) */
  readonly normal: string;
}

/** Where a family's files are, and a variant's optional extra geometry. */
export interface RiggedHullUrls {
  /** A rig URL with embedded maps, or an image-free rig with separate maps. */
  readonly files: Readonly<Record<string, string | RiggedHullFiles>>;
  /** `<hull>:<kind>:<variant>` to its baked coat; absence keeps the authored atlas. */
  readonly coats: Readonly<Record<string, { readonly key: string; readonly image: string }>>;
  readonly coatDecode?: 'bitmap';
  readonly vertexColours?: boolean;
  readonly doubleSided?: readonly string[];
  /**
   * A variant's baked rigid parts (null: none), appended to its hull once: position, normal, uv, color and per vertex
   * `_bone` (the one bone it rides, an index into the variant's bones) and `_glow` (0..1), as a static GLB node loads them.
   * The merged hull's `aOvergrown` = (1: the part's own colour instead of the atlas, glow) on the parts, 0 on the hull.
   */
  readonly parts?: { readonly file: string; readonly nodes: Readonly<Record<string, string>> };
}

/** A generated tier book, a shard generator's own data (its section and schema are deleted,
 * FORMAT-PRUNE FP20). Product references are logical blob names; coats keep their original KTX2 cache keys and image
 * URLs. */
export interface RiggedHullBook {
  readonly family: RiggedHullFamilyRow;
  readonly tiers: Readonly<Record<'phone' | 'desktop', RiggedHullUrls>>;
  readonly productFiles: boolean;
}
