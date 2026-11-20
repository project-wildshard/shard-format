/**
 * The actors a runtime-bound public field may live on: the runtime's boss, home and actor spawns, and (ONE-FORMAT OF22c2)
 * the declared spawn a `boss` encounter names, which is retained the same way.
 */
export function retainedActorIds(
  runtimeIds: readonly string[],
  declaredIds: readonly string[],
  bossEntities: readonly string[],
): Set<string> {
  const declared = new Set(declaredIds)
  return new Set([
    ...runtimeIds,
    ...bossEntities.filter((entity: string): boolean => declared.has(entity)),
  ])
}
