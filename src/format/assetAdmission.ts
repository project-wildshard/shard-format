import { acceptsProductCost, textureLibrarySource } from './deviceMemoryCost.ts';
import { admitScriptContract, decisionModuleContracts, type ScriptAdmissionRows } from './scriptContract.ts';
import type { TextureTranscodeSupport } from './contentBounds.ts';
import { admitScript } from './scriptAdmission.ts';
import { SCRIPT_LIMITS } from './scriptLimits.ts';
import { worstContentCost } from './budget.ts';
import { parseShardfile, type Shardfile } from './shardSchema.ts';
import { assetCost, validateTerrainAssets, validatePropDrawBounds, preflightAssetGraph, type PropExtent } from './product.ts';
import type { MemoryAdmission } from './memoryAdmission.ts';

import { validateMeshCollisionAssets } from './meshCollisionAssets.ts';
import { validateNavigationAssets } from './navigation.ts';
import { validateNativeGround } from './nativeGroundAssets.ts';
import { validateMeshEntryways } from './meshEntryways.ts';
import { glbMaterialNames, validatePropMaterials, type PropMaterials } from './propMaterials.ts';
import { checkTileMaterialNames, splatTextureRefs } from './splatTerrain.ts';
import { validateSkinAssets } from './skinAssets.ts';
import { graphFileRules, inlineGraphRules } from './materials.ts';
import { postStackCost } from './postStack.ts';
import { validateEntrywayTerrain } from './entrywayAssets.ts';
import { validateEntrywayClearance } from './entryClearance.ts';
import { validateSocketLandings } from './entryLanding.ts';
import { portalLinkEntries } from './portalLinkAssets.ts';
import { validatePortalFloors } from './portalFloor.ts';
import { clientScriptViewCost } from './clientScripts.ts';
import { preflightShardfile } from './preflight.ts';

import { compendiumSketches } from './compendiumSketches.ts';
import { assertCommonsCosts, type CommonsCosts } from './commonsCosts.ts';
import { nearPlaceholderCost } from './nearPlaceholder.ts';
import { validateNearPlaceholderAssets } from './nearPlaceholderAssets.ts';


/** Check declared residency before immutable reads; exact parsed headers are checked again on admission. */
function preflightDeclaredCosts(source: Shardfile, memory?: MemoryAdmission): { commons: CommonsCosts; worst: ReturnType<typeof worstContentCost> } {
  const commons = assertCommonsCosts(source.requires.commons, source.requires.commonsCosts);
  if (source.near !== undefined) nearPlaceholderCost(source.near, source);
  const files = new Map(source.files.map(file => [file.hash, file]));
  const closure = (roots: readonly string[]): Set<string> => {
    const found = new Set<string>(), pending = [...roots];
    while (pending.length > 0) {
      const ref = pending.pop(); if (ref === undefined || found.has(ref)) continue;
      found.add(ref); pending.push(...files.get(ref)?.dependencies ?? []);
    }
    return found;
  };
  const sum = (refs: Iterable<string>, excluded: ReadonlySet<string> = new Set(), includeCommons = false) => {
    let resident = 0, compressed = 0, triangles = 0, draws = 0;
    for (const ref of refs) {
      if (excluded.has(ref)) continue;
      const file = files.get(ref), hash = ref.replace(/^commons:/u, ''), shared = includeCommons && ref.startsWith('commons:') ? commons[hash] : undefined;
      if (file !== undefined) { resident += file.decoded + file.gpu; compressed += file.compressed; triangles += file.triangles; draws += file.draws; }
      else if (shared !== undefined) { resident += shared.decoded + shared.gpu; compressed += source.requires.commonsWire[hash] ?? 0; triangles += shared.triangles; draws += shared.draws; }
    }
    return { resident, compressed, triangles, draws };
  };
  const library = closure(source.library), libraryCost = sum(library), critical = sum(closure(source.critical), new Set(), true);
  if (libraryCost.resident > source.budgets.library.resident || libraryCost.compressed > source.budgets.library.compressed) throw new Error('declared bundle cost exceeds budget');
  if (critical.resident > source.budgets.sim.resident || critical.compressed > source.budgets.sim.compressed) throw new Error('declared critical bundle cap or budget exceeded');
  for (const tile of [...source.tiles, ...source.far === null ? [] : [source.far]]) {
    const cost = sum(closure(tile.files), library);
    if (cost.resident > tile.decoded + tile.gpu || cost.compressed > tile.compressed || cost.triangles > tile.triangles || cost.draws > tile.draws) throw new Error('declared tile or far cost exceeds budget');
  }
  const resident = Object.values(commons).reduce((total, cost) => total + cost.decoded + cost.gpu, 0);
  const worst = worstContentCost(source, resident);
  if (!acceptsProductCost(memory, source, 'declared', worst)) throw new Error(`declared worst-location total exceeds envelope: ${worst.playing}`);
  return { commons, worst };
}

/** One `validateShardfileAssets` run's state between its steps. The streaming validator (`product-stream-assets.ts`,
 *  API-CLOUDFLARE AC6a2) runs `admitFileBytes` per file as its bytes stream past, then the rest in this order. */
interface AssetAdmission {
  readonly shard: Shardfile;
  readonly files: Map<string, Shardfile['files'][number]>;
  readonly contracts: ReturnType<typeof decisionModuleContracts>;
  readonly declared: CommonsCosts;
  readonly closure: (roots: readonly string[]) => Set<string>;
  readonly sum: (roots: readonly string[], excluded?: ReadonlySet<string>) => { resident: number; compressed: number; triangles: number; draws: number };
  commons: number;
  readonly commonsCosts: Map<string, ReturnType<typeof assetCost>>;
  readonly admissions: Map<string, ReturnType<typeof admitScriptContract>>;
  readonly propMaterials: NonNullable<Shardfile['props']>['materials'] | undefined;
  readonly propModels: Set<string>;
  readonly scripts: ScriptAdmissionRows;
}

/** The checks before any byte is read: preflight, schema, decision modules, the graph and declared costs. */
// oxlint-disable-next-line eslint/max-statements, typescript/prefer-readonly-parameter-types -- validateShardfileAssets' opening steps, moved whole (AC6a2)
function assetAdmission(input: unknown, memory: MemoryAdmission | undefined, scripts: ScriptAdmissionRows): AssetAdmission {
  preflightShardfile(input);
  const s = parseShardfile(input), files = new Map(s.files.map((f) => [f.hash, f]));
  const contracts = decisionModuleContracts(scripts, s.files);
  const legacyModules = new Set([...s.sim.scripts, ...s.clientScripts.bindings.map(row => row.module), ...s.movers.filter(row => row.execution !== 'native').map(row => row.module)]);
  if ([...contracts.keys()].some(hash => legacyModules.has(hash))) throw new Error('Decision module cannot also use a legacy script host');
  preflightAssetGraph(s);
  const declared = preflightDeclaredCosts(s, memory).commons;
  const closure = (roots: readonly string[]): Set<string> => {
    const found = new Set<string>(), pending = [...roots];
    while (pending.length > 0) {
      const id = pending.pop(); if (id === undefined || found.has(id)) continue; found.add(id);
      if (!id.startsWith('commons:')) pending.push(...(files.get(id)?.dependencies ?? []));
    }
    return found;
  };
  const sum = (roots: readonly string[], excluded: ReadonlySet<string> = new Set()): { resident: number; compressed: number; triangles: number; draws: number } => {
    let resident = 0, compressed = 0, triangles = 0, draws = 0;
    for (const id of closure(roots)) {
      if (id.startsWith('commons:') || excluded.has(id)) continue;
      const f = files.get(id); if (f === undefined) throw new Error('missing dependency');
      resident += f.decoded + f.gpu; compressed += f.compressed; triangles += f.triangles; draws += f.draws;
    }
    return { resident, compressed, triangles, draws };
  };
  const commonsCosts = new Map<string, ReturnType<typeof assetCost>>(), admissions = new Map<string, ReturnType<typeof admitScriptContract>>();
  const propMaterials = s.props?.materials;
  const propModels = new Set([...s.props?.tiles ?? [], ...s.props?.panels ?? [], ...s.props?.models ?? []].map(row => row.file));
  if (s.props?.far !== undefined && s.props.far !== null) propModels.add(s.props.far);
  return { shard: s, files, contracts, declared, closure, sum, commons: 0, commonsCosts, admissions, propMaterials, propModels, scripts };
}

/** The pinned commons: present, of their wire size and hash, and of their pinned costs. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the run's own state, which it updates
function admitCommonsBytes(state: AssetAdmission, assets: ReadonlyMap<string, Uint8Array>, contentHash: (bytes: Uint8Array) => string): void {
  const { shard, declared, commonsCosts } = state;
  for (const hash of shard.requires.commons) {
    const bytes = assets.get(`commons:${hash}`); if (bytes === undefined || bytes.length !== shard.requires.commonsWire[hash] || contentHash(bytes) !== hash) throw new Error('unavailable commons asset or wire size mismatch');
    const cost = assetCost('commons', bytes), pinned = declared[hash];
    if (pinned === undefined || (['decoded', 'gpu', 'triangles', 'draws'] as const).some(key => cost[key] !== pinned[key])) throw new Error('commons cost declaration differs from actual bytes');
    state.commons += cost.decoded + cost.gpu; commonsCosts.set(`commons:${hash}`, cost);
  }
}

/** One listed file's own bytes: hash, size, parsed costs, its script contract and its prop materials. `assets` is read
 *  only for graph files (JSON). */
// oxlint-disable-next-line eslint/max-params, eslint/max-statements, eslint/complexity, typescript/prefer-readonly-parameter-types -- validateShardfileAssets' per-file body, moved whole (AC6a2)
function admitFileBytes(state: AssetAdmission, file: Shardfile['files'][number], bytes: Uint8Array | undefined, assets: ReadonlyMap<string, Uint8Array>, contentHash: (bytes: Uint8Array) => string): void {
  const { shard, contracts, admissions, propMaterials, propModels } = state;
  {
    if (bytes === undefined || bytes.length !== file.compressed || contentHash(bytes) !== file.hash) throw new Error('file hash or wire size mismatch');
    // A legacy shardfile Wasm declaration is v0 unless an exact sim/scripts row declares v1.
    const contract = contracts.get(file.hash) ?? { abi: 0 as const };
    const actual = assetCost(file.kind, bytes, file.kind === 'wasm' ? contract : undefined);
    if (file.kind === 'wasm') admissions.set(file.hash, admitScriptContract(bytes, contract));
    const understated = (['decoded', 'gpu', 'triangles', 'draws'] as const).filter(key => actual[key] > file[key]);
    if (understated.length > 0) throw new Error(`asset cost declaration understated: ${file.hash} (${file.kind}); ${understated.map(key => `${key} ${file[key]} < ${actual[key]}`).join(', ')}`);
    if ((propMaterials !== undefined || shard.props?.splat !== undefined) && propModels.has(file.hash)) {
      checkTileMaterialNames(propMaterials, shard.props?.splat, bytes);
      // Every GLB carries its own used slots; a dependency on another tile must not hide an uncharged texture.
      const used: PropMaterials = {};
      for (const name of glbMaterialNames(bytes)) {
        if (name === shard.props?.splat?.material) {
          if (splatTextureRefs(shard.props.splat).some(ref => !file.dependencies.includes(ref))) throw new Error('Splat terrain GLB must directly declare every layer dependency');
          continue;
        }
        // a splat terrain beside family props (no props.materials): every other name draws with the family
        if (propMaterials === undefined) continue;
        const binding = propMaterials[name]; if (binding === undefined) throw new Error(`Missing admitted prop material ${name}`);
        used[name] = binding;
      }
      validatePropMaterials(used, { look: shard.look.materials, models: [file.hash], textures: shard.props?.textures ?? [], files: shard.files, graphFile: (hash) => assets.get(hash) });
    }
  }
}

/** Every check after the listed files' own bytes: recordings, graph files, closures, budgets, scripts and the placed
 *  assets (navigation, ground, entryways, collision, props, terrain, near and skins). */
// oxlint-disable-next-line eslint/max-params, typescript/prefer-readonly-parameter-types -- validateShardfileAssets' signature
function admitAfterFiles(state: AssetAdmission, assets: ReadonlyMap<string, Uint8Array>, memory?: MemoryAdmission, textures?: TextureTranscodeSupport): Shardfile {
  // oxlint-disable-next-line eslint/id-length -- the old body's name for the shard, kept so it moved unchanged
  const { shard: s, files, contracts, closure, sum, commons, commonsCosts, admissions, scripts } = state;
  for (const ref of new Set(Object.values(s.audio.recordings ?? {}))) {
    const bytes = assets.get(ref); if (bytes === undefined) throw new Error('Missing admitted audio recording');
    assetCost('audio', bytes); // Commons references also need actual supported audio bytes, never an opaque binary.
  }
  const graphFiles = [...inlineGraphRules(s.look.materials), ...graphFileRules(s, (hash) => assets.get(hash)), ...postStackCost(s, (hash) => assets.get(hash)).errors];
  if (graphFiles.length > 0) throw new Error(`material / post graph files: ${graphFiles.join('; ')}`);
  const library = closure(s.library);
  const sketches = compendiumSketches(s.rows, assets);
  const sketchResident = [...sketches.values()].reduce((total, sketch) => total + sketch.decoded + sketch.gpu, 0);
  if (s.sim.scripts.some((id) => !id.startsWith('commons:') && files.get(id)?.kind !== 'wasm')) throw new Error('script reference is not an admitted Wasm file');
  for (const t of s.tiles) {
    const roots = closure(t.files);
    if (t.lod === 1 && [...roots].some((r) => library.has(r))) throw new Error('coarse dependency on library');
    const cost = sum(t.files, library);
    if (cost.resident > t.decoded + t.gpu || cost.compressed > t.compressed || cost.triangles > t.triangles || cost.draws > t.draws) throw new Error('tile dependency cost understated');
  }
  if (s.far !== null) {
    if ([...closure(s.far.files)].some((r) => library.has(r))) throw new Error('far dependency on library');
    const cost = sum(s.far.files);
    if (cost.resident > s.far.decoded + s.far.gpu || cost.compressed > s.far.compressed || cost.triangles > s.far.triangles || cost.draws > s.far.draws) throw new Error('far dependency cost understated');
  }
  for (const [roots, budget] of [[s.library, s.budgets.library], [s.critical, s.budgets.sim]] as const) {
    const cost = sum(roots); if (cost.resident > budget.resident || cost.compressed > budget.compressed) throw new Error('bundle dependency budget understated');
  }
  const critical = closure(s.critical), criticalCost = sum(s.critical);
  let criticalResident = criticalCost.resident, criticalWire = criticalCost.compressed;
  for (const ref of critical) if (ref.startsWith('commons:')) {
    const bytes = assets.get(ref), actual = commonsCosts.get(ref);
    if (bytes === undefined || actual === undefined) throw new Error('unavailable critical commons');
    criticalResident += actual.decoded + actual.gpu; criticalWire += bytes.length;
  }
  if (criticalWire > s.budgets.sim.compressed || s.sim.scripts.some((r) => !critical.has(r)) || [...critical].some((r) => library.has(r))) throw new Error('critical bundle cap, declared wire budget, render-library dependency or script omitted');
  if(s.runtime?.binds?.includes('state')===true){
    const spawns = s.runtime.spawns;
    const actors=new Set([...spawns?.bosses??[], ...spawns?.homes??[], ...spawns?.actors??[]].map(row=>row.id));
    for(const field of s.state.shared.filter(candidate=>candidate.privacy==='public')) {
      if(!scripts.some(row=>row.abi!==2&&Object.values(row.fields).includes(field.name)&&Object.values(row.actors).length>0
        &&Object.values(row.actors).every(actor=>actors.has(actor))))throw new Error('Runtime actor field requires its actual declared sim guest');
    }
  }
  let scriptMemory = 0;
  for (const module of new Set(s.sim.scripts)) {
    let admission = admissions.get(module);
    if (admission === undefined) {
      const bytes = assets.get(module); if (bytes === undefined) throw new Error('unavailable script');
      admission = admitScript(bytes, 0); admissions.set(module, admission);
    }
    // One guest per module: live, last-good and in-flight copies at the admitted growth ceiling.
    scriptMemory += admission.maximumPages * 65536 * 3;
  }
  let decisionSim = 0, decisionView = 0;
  for (const [hash, contract] of contracts) {
    if (scripts.some(row => row.module === `blobs/wasm/${hash}.wasm` && row.side === 'sim')) {
      if (!critical.has(hash) || library.has(hash)) throw new Error('Decision sim module must be critical, outside the render library');
      decisionSim += contract.pages * 65536 * 2;
    } else {
      if (contract.abi === 2) {
        if (!critical.has(hash) || library.has(hash)) throw new Error('Declared ABI2 view module must be critical only');
      } else if (!library.has(hash) || critical.has(hash)) throw new Error('Decision view module must be in the render library only');
      decisionView += contract.pages * 65536 * 2;
    }
  }
  scriptMemory += decisionSim;
  if (s.sim.scripts.length + new Set(scripts.filter(row => row.side === 'sim').map(row => row.module)).size > SCRIPT_LIMITS.instances || scriptMemory > SCRIPT_LIMITS.memoryBytes || criticalResident + scriptMemory > s.budgets.sim.resident || criticalResident + scriptMemory > s.serverBudget.memory) throw new Error('script memory budget understated or above host cap');
  let clientMemory = 0;
  const clientModules = new Set(s.clientScripts.bindings.map((binding) => binding.module));
  for (const module of clientModules) {
    let admission = admissions.get(module);
    if (admission === undefined) {
      const bytes = assets.get(module); if (bytes === undefined) throw new Error('unavailable client script');
      admission = admitScript(bytes, 0); admissions.set(module, admission);
    }
    clientMemory += admission.maximumPages * 65536 * 3;
  }
  clientMemory += decisionView;
  const clientViews = clientScriptViewCost(s.clientScripts);
  const libraryResident = sum(s.library).resident + clientMemory + clientViews.decoded + clientViews.gpu;
  if (clientModules.size + new Set(scripts.filter(row => row.side === 'view').map(row => row.module)).size > SCRIPT_LIMITS.instances || clientMemory > SCRIPT_LIMITS.memoryBytes || libraryResident > s.budgets.library.resident) throw new Error('client script memory or view budget understated or above host cap');
  if (libraryResident + sketchResident > s.budgets.library.resident) throw new Error('compendium sketch raster budget understated');
  const cost = worstContentCost(textureLibrarySource(s, assets, textures), commons);
  if (!acceptsProductCost(memory, s, 'actual', cost)) throw new Error(`worst-location total exceeds envelope: ${cost.playing}`);
  validateNavigationAssets(s, assets);
  validateNativeGround(s, assets);
  validateEntrywayTerrain(s, assets);
  const propExtents = new Map<string, PropExtent>();
  validateEntrywayClearance(s, assets, propExtents);
  validateMeshCollisionAssets(s, assets);
  validateMeshEntryways(s, assets);
  validateSocketLandings(s, assets);
  validatePortalFloors(portalLinkEntries(s.entryways), s, assets);
  validatePropDrawBounds(s, assets, propExtents);
  if (s.terrain !== null) validateTerrainAssets(s.terrain, assets, s);
  if (s.near !== undefined) validateNearPlaceholderAssets(s.near, assets);
  validateSkinAssets(s, assets);
  return s;
}

/** Admit exact bytes, graph closure, script growth and worst-location residency before a runtime is allocated. */
function validateShardfileAssets(input: unknown, assets: ReadonlyMap<string, Uint8Array>, contentHash: (bytes: Uint8Array) => string, memory?: MemoryAdmission, textures?: TextureTranscodeSupport, scripts: ScriptAdmissionRows = []): Shardfile {
  const state = assetAdmission(input, memory, scripts);
  admitCommonsBytes(state, assets, contentHash);
  for (const file of state.shard.files) {
    admitFileBytes(state, file, assets.get(file.hash), assets, contentHash);
  }
  return admitAfterFiles(state, assets, memory, textures);
}

export type { AssetAdmission };
export { admitAfterFiles, admitCommonsBytes, admitFileBytes, assetAdmission, preflightDeclaredCosts, validateShardfileAssets };
