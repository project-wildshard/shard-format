import * as v from 'valibot';
import { CELL_ABOVE, CELL_BELOW } from './contentBounds.ts';
import { isJsonData } from './json.ts';
import { PropMaterialsSchema, propMaterialTextureRefs, validatePropMaterials } from './propMaterials.ts';
import { SplatTerrainSchema, validateSplatTerrain } from './splatTerrain.ts';
import { glbPoint, glbTransform } from './glbTriangles.ts';
import { solidCapsuleWithinCell, solidHullWithinCell } from './prop-hull.ts';
import type { GlbVertex } from './glbTriangles.ts';

const ref = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
const id = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u), v.maxLength(128));
const address = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(7));
const named = v.strictObject({ id, file: ref });
const coord = v.pipe(v.number(), v.finite(), v.minValue(-250), v.maxValue(250));
const height = v.pipe(v.number(), v.finite(), v.minValue(-CELL_BELOW), v.maxValue(CELL_ABOVE));
const finite = v.pipe(v.number(), v.finite());
const extent = v.pipe(finite, v.minValue(0.005), v.maxValue(250));
const point = v.strictObject({ x: coord, y: height, z: coord });
/** OF22a3: a static solid's material is any engine contact material a bake tags (`planks`, `ground`, `flesh`, `shell` beside the body materials). */
const SURFACES = ['wood', 'stone', 'grass', 'sand', 'rock', 'metal', 'earth', 'felt', 'planks', 'ground', 'flesh', 'shell'] as const;
type PropSurface = typeof SURFACES[number];
const surface = v.optional(v.picklist(SURFACES));
const CONTACT_LEAST = 0;
const CONTACT_FRICTION_MAX = 2;
const GROUPS_MAX = 0xFF_FF_FF_FF;
/** OF22a3: a baked solid's own contact: its friction, and its Rapier interaction groups (membership high 16 bits, filter low 16). */
const contact = { friction: v.optional(v.pipe(v.number(), v.finite(), v.minValue(CONTACT_LEAST), v.maxValue(CONTACT_FRICTION_MAX))),
  groups: v.optional(v.pipe(v.number(), v.integer(), v.minValue(CONTACT_LEAST), v.maxValue(GROUPS_MAX))) };
const rotation = v.pipe(v.strictObject({ x: finite, y: finite, z: finite, w: finite }), v.check((q) => Math.abs(q.x ** 2 + q.y ** 2 + q.z ** 2 + q.w ** 2 - 1) < 1e-5, 'unit collider rotation'));
const boxData = v.strictObject({ kind: v.literal('box'), x: coord, y: height, z: coord, hx: extent, hy: extent, hz: extent, yaw: v.optional(finite), rot: v.optional(rotation), surface, ...contact });
function boxWithinCell(b: v.InferOutput<typeof boxData>): boolean {
  const q = b.rot ?? { x: 0, y: Math.sin((b.yaw ?? 0) / 2), z: 0, w: Math.cos((b.yaw ?? 0) / 2) };
  const transform = glbTransform({ translation: [b.x, b.y, b.z], rotation: [q.x, q.y, q.z, q.w] });
  return Array.from({ length: 8 }, (_unused, index) => glbPoint(transform, {
    x: (index & 1) === 0 ? -b.hx : b.hx, y: (index & 2) === 0 ? -b.hy : b.hy, z: (index & 4) === 0 ? -b.hz : b.hz,
  })).every(vertex => Math.abs(vertex.x) <= 250 && Math.abs(vertex.z) <= 250 && vertex.y >= -CELL_BELOW && vertex.y <= CELL_ABOVE);
}
const box = v.pipe(boxData, v.check(boxWithinCell, 'collider within cell'));
interface PropHull extends GlbVertex {
  kind: 'hull';
  points: number[];
  yaw?: number | undefined;
  // oxlint-disable-next-line eslint/id-length -- Quaternion components are part of the wire.
  rot?: (GlbVertex & { w: number }) | undefined;
  surface?: PropSurface | undefined;
  friction?: number | undefined;
  groups?: number | undefined;
}
const MIN_HULL_COORDS = 12;
/** OF22a3: up to 256 points, the largest hull a bake keeps (Driftwood's is 168). */
const MAX_HULL_COORDS = 768;
const AXES_PER_VERTEX = 3;
const COLLIDER_UNIT = 1;
const hullPoints = v.pipe(v.array(finite), v.minLength(MIN_HULL_COORDS), v.maxLength(MAX_HULL_COORDS));
// oxlint-disable-next-line eslint/id-length -- A hull has the same cell-local pose as a prop box.
const hullData = v.strictObject({ kind: v.literal('hull'), x: coord, y: height, z: coord, points: hullPoints,
  yaw: v.optional(finite), rot: v.optional(rotation), surface, ...contact });
const hull = v.pipe(hullData, v.check<v.InferOutput<typeof hullData>, string>(solidHullWithinCell, 'solid hull within cell'));
const treads = v.pipe(v.strictObject({ kind: v.literal('treads'), from: point, to: point, width: extent, count: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(256)), surface, ...contact }), v.check((t) => Math.hypot(t.to.x - t.from.x, t.to.z - t.from.z) > 0 && t.to.y >= t.from.y && [t.from, t.to].every((p) => Math.abs(p.x) + t.width / 2 <= 250 && Math.abs(p.z) + t.width / 2 <= 250), 'bounded nondegenerate stair'));
/** OF22a3: an upright capsule (or turned by `yaw`/`rot`): the straight part's half height and the radius, whole inside the cell. */
// oxlint-disable-next-line eslint/id-length -- A capsule has the same cell-local pose as a prop box.
const capsuleData = v.strictObject({ kind: v.literal('capsule'), x: coord, y: height, z: coord, halfHeight: extent, radius: extent,
  yaw: v.optional(finite), rot: v.optional(rotation), surface, ...contact });
const capsule = v.pipe(capsuleData, v.check<v.InferOutput<typeof capsuleData>, string>(solidCapsuleWithinCell, 'capsule within cell'));
const collider = v.strictObject({ id, panel: v.nullable(id), initialActive: v.boolean(), shapes: v.pipe(v.array(v.variant('kind', [box, treads, hull, capsule])), v.minLength(1), v.maxLength(256)) });
const BODY_EXTENT_MIN = 0.005;
const BODY_EXTENT_MAX = 8;
const BODY_DENSITY_MIN = 1;
const BODY_DENSITY_MAX = 20_000;
const BODY_FRICTION_MAX = 2;
const BODY_DAMPING_MAX = 10;
const BODIES_MAX = 64;
const BODY_LEAST = 0;
const BODIES_LEAST = 1;
const BODY_SHARE_MAX = 1;
const halfExtent = v.pipe(finite, v.minValue(BODY_EXTENT_MIN), v.maxValue(BODY_EXTENT_MAX));
const share = v.pipe(finite, v.minValue(BODY_LEAST), v.maxValue(BODY_SHARE_MAX));
const friction = v.pipe(finite, v.minValue(BODY_LEAST), v.maxValue(BODY_FRICTION_MAX));
const damping = v.pipe(finite, v.minValue(BODY_LEAST), v.maxValue(BODY_DAMPING_MAX));
const density = v.pipe(finite, v.minValue(BODY_DENSITY_MIN), v.maxValue(BODY_DENSITY_MAX));
const ballShape = v.strictObject({ ball: halfExtent });
const cylinderShape = v.strictObject({ cylinder: v.strictObject({ radius: halfExtent, halfHeight: halfExtent }) });
const cuboidShape = v.strictObject({ cuboid: v.strictObject({ x: halfExtent, y: halfExtent, z: halfExtent }) });
const bodyShape = v.union([ballShape, cylinderShape, cuboidShape]);
const bodyMaterial = v.picklist(['wood', 'stone', 'grass', 'sand', 'rock', 'metal', 'earth', 'felt']);
/** SHARD-SOURCE SS9a: a touchable panel. The server keeps it as one Rapier dynamic body (its rest pose `at` and `yaw`,
 * the shape's half extents in metres); players push it, and every page draws the panel at the body's pose. */
const body = v.strictObject({ id, panel: id, at: point, yaw: finite, shape: bodyShape, material: bodyMaterial,
  density: v.exactOptional(density), friction: v.exactOptional(friction), restitution: v.exactOptional(share),
  linearDamping: v.exactOptional(damping), angularDamping: v.exactOptional(damping), keep: v.exactOptional(v.boolean()) });
const bodies = v.pipe(v.array(body), v.minLength(BODIES_LEAST), v.maxLength(BODIES_MAX));
/** Each body has its own id and names a declared panel that no other body and no static collider claims. */
function bodiesAdmitted(section: { readonly bodies?: readonly { readonly id: string; readonly panel: string }[] | undefined; readonly panels: readonly { readonly id: string }[]; readonly colliders: readonly { readonly panel: string | null }[] }): boolean {
  const declared = new Set(section.panels.map((panel): string => panel.id));
  const claimed = new Set(section.colliders.map((solid): string | null => solid.panel));
  const rows = section.bodies ?? [];
  const ids = new Set(rows.map((row): string => row.id));
  const owned = new Set(rows.map((row): string => row.panel));
  return ids.size === rows.length && owned.size === rows.length && rows.every((row): boolean => declared.has(row.panel) && !claimed.has(row.panel));
}
type CostedShape = Readonly<{ kind: 'treads'; count: number }> | Readonly<{ kind: 'hull'; points: readonly number[] }> | Readonly<{ kind: 'box' | 'capsule' }>;
/** OF22a3: a baked island's solids (Driftwood: about 13,500 units, which its native bake admits today) fit; a hull point costs one unit. */
const COLLIDER_BUDGET = 16_384;
function withinColliderBudget(rows: readonly Readonly<{ shapes: readonly CostedShape[] }>[]): boolean {
  let total = 0;
  for (const row of rows) {
    for (const shape of row.shapes) {
      if (shape.kind === 'treads') { total += shape.count; }
      else if (shape.kind === 'hull') { total += shape.points.length / AXES_PER_VERTEX; }
      else { total += COLLIDER_UNIT; }
    }
  }
  return total <= COLLIDER_BUDGET;
}
/** Declared self-contained GLBs: merged tile meshes, EXT_mesh_gpu_instancing lists, far proxy and script-addressable panels. */
export const PropsSchema: v.GenericSchema<PropsDataInput, PropsData> = v.pipe(v.unknown(), v.check(isJsonData, 'JSON-only props'), v.strictObject({ version: v.literal(1), family: id,
  materials: v.exactOptional(PropMaterialsSchema),
  /** Explicit visual-only edge allowance in metres; absent preserves the fixed-cell refusal. */
  overhang: v.exactOptional(v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1))),
  /** Exact whole source draws in ordinary library GLBs, installed only by a props-bound runtime. */
  wholeLibrary: v.exactOptional(v.pipe(v.array(ref), v.minLength(1), v.maxLength(512), v.check(rows => new Set(rows).size === rows.length, 'unique whole library refs'))),
  splat: v.exactOptional(SplatTerrainSchema),
  tiles: v.pipe(v.array(v.strictObject({ lod: v.picklist([0, 1]), x: address, z: address, file: ref,
    additionalFiles: v.exactOptional(v.pipe(v.array(ref), v.minLength(1), v.maxLength(128))) })), v.maxLength(80)),
  panels: v.pipe(v.array(v.strictObject({ id, file: ref, visible: v.optional(v.boolean(), true) })), v.maxLength(64)), models: v.pipe(v.array(named), v.maxLength(64)), far: v.nullable(ref),
  colliders: v.optional(v.pipe(v.array(collider), v.maxLength(1024)), []),
  textures: v.pipe(v.array(v.strictObject({ model: ref, colour: ref })), v.maxLength(256)),
  bodies: v.exactOptional(bodies),
}), v.check((s) => new Set(s.tiles.map((tile) => `${tile.lod}/${tile.x}/${tile.z}`)).size === s.tiles.length && s.tiles.every((tile) => tile.x < (tile.lod === 0 ? 8 : 4) && tile.z < (tile.lod === 0 ? 8 : 4)) && new Set([...s.panels, ...s.models].map((entry) => entry.id)).size === s.panels.length + s.models.length && new Set(s.textures.map((texture) => texture.model)).size === s.textures.length && new Set(s.colliders.map((solid) => solid.id)).size === s.colliders.length && withinColliderBudget(s.colliders) && s.colliders.every((solid) => solid.panel === null || s.panels.some((panel) => panel.id === solid.panel)), 'unique props addresses and ids'), v.check<PropsData, string>(bodiesAdmitted, 'touchable bodies have unique ids and each names its own panel, which no static collider claims'));
/** Validated data for the props renderer; no callbacks, URLs or generator code enter this section. */
export type ShardProps = v.InferOutput<typeof PropsSchema>;
/** Check every render binding against ordinary admitted file, tile and library rows before allocating content. */
export function validatePropsReferences(props: ShardProps, content: { files: readonly { hash: string; kind: string; dependencies: readonly string[] }[]; tiles: readonly { lod: number; x: number; z: number; files: readonly string[] }[]; library: readonly string[]; far: { files: readonly string[] } | null; look?: { materials: Parameters<typeof validatePropMaterials>[1]['look'] } }): void {
  const files = new Map(content.files.map((f) => [f.hash, f]));
  const model = (hash: string) => { if (files.get(hash)?.kind !== 'glb') throw new Error('Prop model must reference an admitted GLB'); };
  for (const tile of props.tiles) {
    const refs = [tile.file, ...tile.additionalFiles ?? []];
    if (new Set(refs).size !== refs.length) throw new Error('Props tile repeats a file');
    for (const hash of refs) { model(hash); if (!content.tiles.find((t) => t.lod === tile.lod && t.x === tile.x && t.z === tile.z)?.files.includes(hash)) throw new Error('Props tile disagrees with tile files'); }
  }
  for (const hash of props.wholeLibrary ?? []) { model(hash); if (!content.library.includes(hash)) throw new Error('Whole geometry must belong to the library'); }
  for (const entry of [...props.panels, ...props.models]) { model(entry.file); if (!content.library.includes(entry.file)) throw new Error('Prop panel/model must belong to the library'); }
  if (props.far !== null) { model(props.far); if (!content.far?.files.includes(props.far)) throw new Error('Props far proxy disagrees with far files'); }
  const refs = new Set([...props.tiles.flatMap((t) => [t.file, ...t.additionalFiles ?? []]), ...props.panels.map((p) => p.file), ...props.models.map((p) => p.file), ...(props.far === null ? [] : [props.far])]);
  for (const texture of props.textures) if (!refs.has(texture.model) || !['ktx2', 'image'].includes(files.get(texture.colour)?.kind ?? '') || !files.get(texture.model)?.dependencies.includes(texture.colour)) throw new Error('Prop texture must be a declared KTX2 dependency');
  if (props.materials !== undefined) validatePropMaterials(props.materials, { look: content.look?.materials ?? {}, models: [...refs], textures: props.textures, files: content.files });
  if (props.splat !== undefined) {
    if (props.materials !== undefined && Object.hasOwn(props.materials, props.splat.material)) throw new Error('Splat terrain material cannot also name a prop material');
    validateSplatTerrain(props.splat, { look: content.look?.materials ?? {}, tiles: props.tiles.map(tile => tile.file),
      propTextures: [...props.textures.map(texture => texture.colour), ...propMaterialTextureRefs(props.materials)], files: content.files });
  }
}


/** Admitted data contracts, independent of validator implementation metadata. */
export type PropsDataInput = unknown;
interface PropsDataFields {
    version: 1;
    family: string;
    materials?: v.InferOutput<typeof PropMaterialsSchema>;
    overhang?: number;
    wholeLibrary?: (string)[];
    splat?: v.InferOutput<typeof SplatTerrainSchema>;
    tiles: ({
        lod: 0 | 1;
        x: number;
        z: number;
        file: string;
        additionalFiles?: (string)[];
    })[];
    panels: ({
        id: string;
        file: string;
        visible: boolean;
    })[];
    models: ({
        id: string;
        file: string;
    })[];
    far: (string) | null;
    colliders: ({
        id: string;
        panel: (string) | null;
        initialActive: boolean;
        shapes: (({
            kind: 'box';
            x: number;
            y: number;
            z: number;
            hx: number;
            hy: number;
            hz: number;
            yaw?: number | undefined;
            rot?: {
                x: number;
                y: number;
                z: number;
                w: number;
            } | undefined;
            surface?: PropSurface | undefined;
            friction?: number | undefined;
            groups?: number | undefined;
        }) | PropHull | PropCapsule | ({
            kind: 'treads';
            from: {
                x: number;
                y: number;
                z: number;
            };
            to: {
                x: number;
                y: number;
                z: number;
            };
            width: number;
            count: number;
            surface?: PropSurface | undefined;
            friction?: number | undefined;
            groups?: number | undefined;
        }))[];
    })[];
    textures: ({
        model: string;
        colour: string;
    })[];
    bodies?: PropsBody[];
}
/** OF22a3: a static capsule solid. */
interface PropCapsule extends GlbVertex {
    kind: 'capsule';
    halfHeight: number;
    radius: number;
    yaw?: number | undefined;
    // oxlint-disable-next-line eslint/id-length -- Quaternion components are part of the wire.
    rot?: (GlbVertex & { w: number }) | undefined;
    surface?: PropSurface | undefined;
    friction?: number | undefined;
    groups?: number | undefined;
}
/** SS9a: a point, or a cuboid's half extents, in metres. */
interface PropsBodyVector { x: number; y: number; z: number }
/** SS9a: one touchable panel's body. */
interface PropsBody {
    id: string;
    panel: string;
    at: PropsBodyVector;
    yaw: number;
    shape: { ball: number } | { cylinder: { radius: number; halfHeight: number } } | { cuboid: PropsBodyVector };
    material: 'wood' | 'stone' | 'grass' | 'sand' | 'rock' | 'metal' | 'earth' | 'felt';
    density?: number;
    friction?: number;
    restitution?: number;
    linearDamping?: number;
    angularDamping?: number;
    keep?: boolean;
}
export type PropsData = { [Key in keyof PropsDataFields]: PropsDataFields[Key] };
