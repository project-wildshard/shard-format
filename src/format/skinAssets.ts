/**
 * Exported skins as creature looks (SHARD-PLATFORM SF16, the format half of the creature seam). A look row whose recipe
 * is `platform.skin` draws its species with an SF9c exported skin instead of a procedural view recipe:
 *
 *   { id, species, recipe: 'platform.skin', material: null, parameters: { skin: '<json file hash>' },
 *     animation: { recipe: 'platform.clips', parameters: { attackSpan: 1 } } }
 *
 * `skin` names a `json` file (`ShardSkinFileSchema`: the export's rig row and its binding) whose one dependency is the
 * skin's `glb` file. Both sit in the library closure, so the loader admits, leases and charges them as declared. The
 * clips are chosen from the creature's state (idle / walk / attack / hit / die, `idle.graze` when grazing);
 * `attackSpan` is the attack duration the export sampled the attack clip with (seconds).
 */
import * as v from 'valibot';
import { validateCreatureBones } from './skinData.ts';
import type { SkinRow } from './skinData.ts';
import type { Shardfile } from './shardSchema.ts';
import { parseGlbData as parseGlb } from './glbCost.ts';
import { skinLayerDecoded } from './skinLayers.ts';
import { MaterialsSchema } from './materials.ts';
import { SkinGlbMaterialsSchema, SkinPrimitiveSchema, skinMaterialsFault, skinPartsFault, skinPrimitiveCount } from './skin-materials.ts';

import { SKIN_LOOK_RECIPE, SKIN_CLIPS_RECIPE } from './skins.ts';
import type { SkinLookParameters } from './skins.ts';
import { lookSkins, resolveSkinLookFiles } from './skin-variants.ts';
import { skinLookParameters } from './skin-file.ts';

/** An optional look reference names a library `json` file. */
function libraryJson(library: readonly string[], kinds: ReadonlyMap<string, string>, hash: string | undefined): boolean {
  return hash === undefined || kinds.get(hash) === 'json' && library.includes(hash);
}

/** Shardfile reference rules for skin looks: a library `json` file whose dependencies are exactly its row's `glb`. */
function skinLookRules(source: Pick<Shardfile, 'rows' | 'files' | 'library'>): string[] {
  const errors: string[] = [], files = new Map(source.files.map((file) => [file.hash, file]));
  const kinds = new Map<string, string>(); for (const file of source.files) {kinds.set(file.hash, file.kind);}
  for (const row of source.rows.looks) {
    if (row.recipe !== SKIN_LOOK_RECIPE) { if (row.animation.recipe === SKIN_CLIPS_RECIPE) {errors.push('skin clips without a skin look');} continue; }
    let parameters: SkinLookParameters; try { parameters = skinLookParameters(row); } catch { errors.push('skin look parameters'); continue; }
    const { skin, variants, phone } = parameters, file = files.get(skin), glb = files.get(file?.dependencies[0] ?? '');
    // OF27b: a skin file depends on its GLB, then its material's textures (KTX2 files or commons)
    const textures = file?.dependencies.slice(1) ?? [];
    if (file?.kind !== 'json' || glb?.kind !== 'glb' || !source.library.includes(skin)
      || textures.some((ref): boolean => !ref.startsWith('commons:') && files.get(ref)?.kind !== 'ktx2')) {errors.push('skin look file references');}
    if (!libraryJson(source.library, kinds, variants)) {errors.push('skin variant table references');}
    if (!libraryJson(source.library, kinds, phone)) {errors.push('skin phone file references');}
  }
  return errors;
}

const glbRigSchema = v.object({
  nodes: v.array(v.object({ name: v.optional(v.string()), mesh: v.optional(v.number()), skin: v.optional(v.number()) })),
  meshes: v.array(v.object({ primitives: v.array(SkinPrimitiveSchema) })),
  materials: SkinGlbMaterialsSchema,
  skins: v.array(v.object({ joints: v.array(v.number()) })),
  animations: v.optional(v.array(v.object({ name: v.optional(v.string()) })), []),
});

/** Check admitted GLB joint order, sockets and clips before a renderer allocates the creature view. */
function validateRigBytes(glb: Uint8Array, row: SkinRow, parts: Readonly<Record<string, string>> | undefined): void {
  // ParseGlb already bounds and validates the header, JSON chunk and every node/accessor reference.
  const length = new DataView(glb.buffer, glb.byteOffset, glb.byteLength).getUint32(12, true);
  const rig = v.parse(glbRigSchema, JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + length))));
  function fail(reason: string): never { throw new Error(`skin ${row.id}: ${reason}`); }
  const named = rig.nodes.flatMap(node => node.name === undefined ? [] : [node.name]);
  const meshes = rig.nodes.filter(node => node.skin !== undefined && node.mesh !== undefined);
  const mesh = meshes[0];
  if (meshes.length !== 1 || mesh?.mesh === undefined || mesh.skin === undefined
    || !skinPrimitiveCount(rig.meshes[mesh.mesh]?.primitives.length)) {fail('expected one skinned mesh');}
  const partsFault = skinPartsFault(rig.meshes[mesh.mesh]?.primitives ?? [], rig.materials, parts);
  if (partsFault !== '') { fail(partsFault); }
  const joints = rig.skins[mesh.skin]?.joints.map(index => rig.nodes[index]?.name);
  const expected = row.rig.joints[0];
  if (joints === undefined || expected === undefined || joints.length !== expected.length
    || joints.some((name, index) => name !== expected[index])) {fail('skin joint order differs from bake');}
  for (const name of row.rig.sockets) {
    if (named.filter(actual => actual === name).length !== 1) {fail(`missing or ambiguous socket ${name}`);}
  }
  for (const name of row.rig.clips) {
    if (rig.animations.filter(clip => clip.name === name).length !== 1) {fail(`missing or ambiguous clip ${name}`);}
  }
}

/** Admit each rig binding and its exact GLB dependency before allocating a client view. */
function validateSkinAssets(source: Pick<Shardfile, 'rows' | 'files'> & { readonly look?: Pick<Shardfile['look'], 'materials'> }, assets: ReadonlyMap<string, Uint8Array>): void {
  const files = new Map(source.files.map((file) => [file.hash, file]));
  for (const look of source.rows.looks) {
    if (look.recipe !== SKIN_LOOK_RECIPE) {continue;}
    const resolved = resolveSkinLookFiles(source, look, assets);
    const skins = new Map(lookSkins(resolved).map((skin): [string, typeof resolved.skin] => [skin.hash, skin]));
    for (const { row, binding } of skins.values()) {

    validateCreatureBones(look.species, row.rig.sockets);
    validateCreatureBones(look.species, row.rig.joints[0] ?? []);
    v.parse(MaterialsSchema, { skin: binding.material });
    const glb = assets.get(row.file); const declared = files.get(row.file);
    if (glb === undefined || declared === undefined) {throw new Error('skin GLB missing');}
    const cost = parseGlb(glb);
    validateRigBytes(glb, row, binding.materials);
    const undeclared = skinMaterialsFault(binding.materials, source.look?.materials ?? {});
    if (undeclared !== '') { throw new Error(undeclared); }
    cost.decoded += skinLayerDecoded(binding.poseLayers ?? {}, row.rig.joints[0]?.length ?? 0);
    for (const key of ['decoded', 'gpu', 'triangles', 'draws'] as const) {
      if (cost[key] > row.cost[key] || cost[key] > declared[key]) {throw new Error('skin cost understated');}
    }
    }
  }
}

export { parseSkinFile, skinLookParameters } from './skin-file.ts';
export { resolveSkinLookFiles, skinFileDependencies } from './skin-variants.ts';
export { skinLookRules, validateSkinAssets };
