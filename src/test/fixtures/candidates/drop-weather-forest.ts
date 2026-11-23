/** SHARD-COMPAT FE3b: a candidate format that removes the `weather.forest` client plan kind with no migration. Pine and
 * Nalati declare it, so the corpus names them and the path. */
import type {
  Candidate,
  CandidateFailure,
} from '../../../cli/corpus-candidate.ts'

const PLAN = 'sections/client/plan.json'
const GONE = 'weather.forest'

/** Every `weather.forest` row left in the copy's client plan. */
function forestRows(
  files: ReadonlyMap<string, Uint8Array>,
): readonly CandidateFailure[] {
  const bytes = files.get(PLAN)
  if (bytes === undefined) {
    return []
  }
  const plan: unknown = JSON.parse(new TextDecoder().decode(bytes))
  const features: unknown =
    typeof plan === 'object' && plan !== null
      ? Reflect.get(plan, 'features')
      : undefined
  if (!Array.isArray(features)) {
    return []
  }
  return features.flatMap((row: unknown, at: number): CandidateFailure[] =>
    typeof row === 'object' && row !== null && Reflect.get(row, 'kind') === GONE
      ? [
          {
            path: PLAN,
            reason: `features.${String(at)}.kind ${GONE} is removed`,
          },
        ]
      : [],
  )
}

const candidate: Candidate = { id: 'drop-weather-forest', check: forestRows }

export { candidate, forestRows }
