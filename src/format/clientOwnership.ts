import { hasDeclaredClientPage } from './runtimeBinds.ts';
import type { Shardfile } from './shardSchema.ts';
import { parseClientPlan } from './clientPlan.ts';
import { parseNativeRuntimePlan, nativeRuntimeActorIds } from './nativeRuntimePlan.ts';
import { pageDrawsDeclaredLooks, rigLookRules } from './rig-looks.ts';

/** Cross-section ownership replaces the former runtime-only requirement. This
 * runs on author output and checked network/native products before allocation. */
export function clientOwnershipRules(source: Shardfile, sections: ReadonlyMap<string, unknown>): readonly string[] {
  const raw = sections.get('client/plan'), rigs = rigLookRules(source.rows.looks, sections);
  const features = raw === undefined ? [] : parseClientPlan(raw).features;
  const page = hasDeclaredClientPage(source), native = features.some(row => row.kind === 'population.homes');
  if (!page && !native) return rigs;
  // OF19d1: a page drawing its declared bodies from their looks needs no species program
  const errors: string[] = [...rigs], program = !pageDrawsDeclaredLooks(source, sections.get('sim/runtime-plan'), features);
  if (!page || source.runtime !== null) errors.push('Native client features require their typed data page owner');
  for (const kind of ['world.scenes', 'motion.channels', ...program ? ['species.program'] as const : [], 'held.melee', 'quest.page'] as const)
    if (!features.some(row => row.kind === kind)) errors.push(`Data page requires ${kind}`);
  const quest = features.find(row => row.kind === 'quest.page'), held = features.find(row => row.kind === 'held.melee');
  const declared = source.questHost?.page;
  if (quest?.kind !== 'quest.page' || declared === undefined || !('version' in declared)
    || declared.quest !== quest.rows.id || !source.quests.quests.some(row => row.id === quest.rows.id)
    || !source.questNpcs?.some(row => !('kind' in row) && row.npc.id === quest.rows.npc)) errors.push('Data page requires its original declared quest and NPC');
  if (held?.kind !== 'held.melee' || source.items.loadout.primary !== held.item || source.items.loadout.secondary !== null
    || source.items.loadout.tools.length > 0 || !source.items.rows.some(row => row.kind === 'weapon' && row.id === held.item)) errors.push('Data page requires its one admitted held primary');
  // ONE-FORMAT OF19b0/OF19c0: declared spawns, their species and encounters run beside the plan's keeper (the engine
  // refuses a body both own); declared crowds do not
  if (source.crowds.length > 0) errors.push('Data page native roster cannot also install declared crowds');
  for (const name of ['world/scenes', 'world/targets', ...program ? ['actors/species-programs'] : [], 'sim/runtime-plan', 'sim/scripts', 'look/painted'])
    if (!sections.has(name)) errors.push(`Data page requires ${name}`);
  const channels = new Set(source.clientChannels?.map(row => row.id));
  for (const feature of features) if (feature.kind === 'motion.channels') {
    const programs = feature.rows.groups.flatMap(group => group.programs).concat(feature.rows.frames.map(frame => frame.program));
    if (programs.some(id => !channels.has(id))) errors.push('Data page motion requires every declared channel program');
  }
  const rawPlan = sections.get('sim/runtime-plan');
  if (rawPlan !== undefined) {
    const plan = parseNativeRuntimePlan(rawPlan), owner = plan.recipe.population.owner;
    const bosses = features.filter(row => row.kind === 'boss.held' || row.kind === 'boss.spawned');
    const keeper = nativeRuntimeActorIds(plan);
    // OF19c0b: a plan with no owner row has no keeper boss for a page boss feature to draw (its boss is declared). OF20c: nor
    // does an owner row naming a declared spawn with a declared boss encounter; that encounter takes the row's flag, fact,
    // purse and save, and the page draws it from the encounter's declared `ui` panel.
    let fought = false;
    let spawned = false;
    for (const spawn of source.creatures.spawns) { spawned ||= spawn.id === owner?.actor; }
    for (const row of source.encounters) { fought ||= row.kind === 'boss' && row.entity === owner?.actor; }
    const declaredOwner = owner !== undefined && !keeper.includes(owner.actor) && spawned && fought;
    const expected = owner === undefined || declaredOwner ? [] : [owner];
    if (bosses.length !== expected.length || bosses.some(row => row.actor !== owner?.actor || (row.kind === 'boss.held') !== (owner.profile.pattern === 'held')))
      errors.push('Data page requires its actual native encounter pattern');
    // A declared spawn is a body the quest may name too
    const actors = new Set(keeper);
    for (const spawn of source.creatures.spawns) { actors.add(spawn.id); }
    if (source.questHost?.actors.ids.some(id => !actors.has(id))) errors.push('Data page quest requires actual native actors');
  }
  return errors;
}
