/** SHARD-COMPAT FE3b: the same removal shipped with a rename migration (`weather.forest` becomes `weather.woods`), so
 * every original that declared it migrates. */
import { renameKind } from '../../../format/format-migration-ops.ts'
import { forestRows } from './drop-weather-forest.ts'

import type { Candidate } from '../../../cli/corpus-candidate.ts'

const candidate: Candidate = {
  id: 'rename-weather-forest',
  migrations: [
    {
      id: 'fe3b-weather-woods',
      to: '0.1.0.4',
      touches: 'data',
      affects: [],
      apply: renameKind({
        from: 'weather.forest',
        to: 'weather.woods',
        keys: ['kind'],
      }),
    },
  ],
  check: forestRows,
}

export { candidate }
