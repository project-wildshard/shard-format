// oxlint-disable typescript/prefer-readonly-parameter-types -- a step edits the shard it is handed, in place
/** FORMAT-PRUNE FP43's chain step (J486, CP16): `population.homes` left the client plan (engine `8848e8930` refuses it at
 * runtime), but kept originals still carry it (Far Reach r1 and r3 to r6, Sunscar Dunes r1, r2 and r5), so the format
 * refused them as stored with no step to mend them. The copy drops the row, and a trail row that followed one of its
 * groups names that group's members instead, the spawn ids the homes row listed, as FP38 did by hand in Sky Reach. */
import type { FormatMigration, MigratingShard } from './format-migrations.ts'

type JsonRecord = Record<string, unknown>

const HOMES = 'population.homes'
const TRAIL = 'fx.trail'
const PLANS = ['client/plan', 'server/plan'] as const
/** The format that first refuses the row (FP43 rides format 0.1.0.5 with FP33). */
const HOMES_GONE = '0.1.0.5'

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A plan's feature rows, or none. */
function featuresOf(plan: unknown): unknown[] {
  if (!isRecord(plan)) {
    return []
  }
  const { features } = plan
  return Array.isArray(features) ? features : []
}

function kindIs(row: unknown, kind: string): row is JsonRecord {
  return isRecord(row) && row['kind'] === kind
}

/** Every group the plan's homes rows declare, by name: the spawn ids in it. */
function homeGroups(features: readonly unknown[]): Map<string, unknown> {
  const groups = new Map<string, unknown>()
  for (const row of features) {
    if (kindIs(row, HOMES) && isRecord(row['groups'])) {
      for (const [name, members] of Object.entries(row['groups'])) {
        groups.set(name, members)
      }
    }
  }
  return groups
}

/** A trail row that names `group` names that group's `members` in the same place; one naming no known group stays as it is
 * and the copy's validator names it. */
function trailMembers(
  row: JsonRecord,
  groups: ReadonlyMap<string, unknown>,
): void {
  const { group } = row
  if (typeof group !== 'string' || !groups.has(group)) {
    return
  }
  const entries = Object.entries(row)
  for (const [key] of entries) {
    Reflect.deleteProperty(row, key)
  }
  for (const [key, value] of entries) {
    if (key === 'group') {
      row['members'] = groups.get(group)
    } else {
      row[key] = value
    }
  }
}

/** One plan: trails first take their members from the homes rows, then the homes rows go. */
function migratePlan(plan: unknown): void {
  if (!isRecord(plan) || !Array.isArray(plan['features'])) {
    return
  }
  const features = featuresOf(plan)
  const groups = homeGroups(features)
  for (const feature of features) {
    if (kindIs(feature, TRAIL) && Array.isArray(feature['rows'])) {
      for (const row of feature['rows']) {
        if (isRecord(row)) {
          trailMembers(row, groups)
        }
      }
    }
  }
  plan['features'] = features.filter(
    (row: unknown): boolean => !kindIs(row, HOMES),
  )
}

/** FORMAT-PRUNE FP43: the copy carries no `population.homes` row, and its trails name their members. */
const homesToMembers: FormatMigration = {
  id: 'fp43-homes-to-members',
  to: HOMES_GONE,
  touches: 'data',
  affects: [],
  apply: (shard: MigratingShard): void => {
    for (const name of PLANS) {
      migratePlan(shard.sections.get(name))
    }
  },
}

export { homesToMembers }
