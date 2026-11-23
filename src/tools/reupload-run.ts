import { reuploadPlan, usersOf } from './reupload-plan.ts'

import type { CorpusRow } from '../cli/corpus.ts'
import type { Deprecation } from '../format/deprecations.ts'
import type { ReuploadStep, Users } from './reupload-plan.ts'

// SHARD-COMPAT CP17 (J486, Q31): the re-upload run. It plans (FE7's count
// over the kept originals), dispatches every first-party re-publish at
// once, waits for each shard's new revision, then counts again. Its I/O is
// injected: `reupload.ts` wires the API, `gh` and the corpus; tests wire
// doubles.

interface ReuploadIo {
  /** Every kept original with its FE7 deprecation ids (FE3's corpus). */
  readonly corpus: () => Promise<readonly Readonly<CorpusRow>[]>
  /** Start the repo's `publish.yml` for this slug. */
  readonly dispatch: (repo: string, slug: string) => Promise<void>
  /** The shard's first revision above `after`, once the API has it; undefined on time-out. */
  readonly settle: (slug: string, after: number) => Promise<number | undefined>
}

interface Republished {
  readonly slug: string
  readonly from: number
  readonly to: number | undefined
}

interface ReuploadResult {
  readonly id: string
  readonly steps: readonly ReuploadStep[]
  readonly before: Users
  readonly republished: readonly Republished[]
  readonly after: Users
}

async function republish(
  io: Readonly<ReuploadIo>,
  step: Readonly<ReuploadStep>,
): Promise<Republished> {
  await io.dispatch(step.repo ?? '', step.slug)
  return {
    slug: step.slug,
    from: step.revision,
    to: await io.settle(step.slug, step.revision),
  }
}

interface ReuploadRun {
  readonly deprecation: Readonly<Deprecation>
  readonly repos: Readonly<Record<string, string>>
  readonly io: Readonly<ReuploadIo>
  /** False plans only. */
  readonly apply: boolean
}

/** Plan, and with `apply`, re-publish the first-party users and count again. */
async function reupload(
  options: Readonly<ReuploadRun>,
): Promise<ReuploadResult> {
  const { deprecation, repos, io, apply } = options
  const rows = await io.corpus()
  const steps = reuploadPlan(rows, deprecation, repos)
  const before = usersOf(rows, deprecation.id)
  const chosen = apply
    ? steps.filter(
        (step: Readonly<ReuploadStep>): boolean => step.action === 'republish',
      )
    : []
  const republished = await Promise.all(
    chosen.map(
      async (step: Readonly<ReuploadStep>): Promise<Republished> =>
        await republish(io, step),
    ),
  )
  const after = apply ? usersOf(await io.corpus(), deprecation.id) : before
  return { id: deprecation.id, steps, before, republished, after }
}

function stepLine(step: Readonly<ReuploadStep>): string {
  return `  ${step.action.padEnd('needs-author'.length)} ${step.slug} r${String(step.revision)}: ${step.detail}`
}

function republishedLine(row: Readonly<Republished>): string {
  return row.to === undefined
    ? `  ${row.slug}: no new revision above r${String(row.from)} yet`
    : `  ${row.slug}: r${String(row.from)} -> r${String(row.to)}`
}

function countLine(users: Readonly<Users>): string {
  return `${String(users.heads.length)} shards' newest revisions (${users.heads.join(', ') || 'none'}); ${String(users.kept.length)} kept originals`
}

/** The run's report: the plan, each re-publish, and the counts before and after. */
function reuploadReport(result: Readonly<ReuploadResult>): string {
  return [
    `re-upload ${result.id}: before, ${countLine(result.before)}`,
    ...result.steps.map(stepLine),
    ...result.republished.map(republishedLine),
    `after, ${countLine(result.after)} (CP12's daily prune removes superseded revisions)`,
  ].join('\n')
}

export { reupload, reuploadReport }
export type { Republished, ReuploadIo, ReuploadResult, ReuploadRun }
