import {
  exactOptional,
  finite,
  maxValue,
  minValue,
  number,
  picklist,
  pipe,
  strictObject,
} from 'valibot'

import type { GenericSchema } from 'valibot'

/** Open water stands within the same bounds as an edge row's heights. */
const WATER_LIMIT = 250
const water = pipe(
  number(),
  finite(),
  minValue(-WATER_LIMIT),
  maxValue(WATER_LIMIT),
)
const geometry = picklist(['ground', 'void'])

interface EdgeObservationRowFields {
  geometry?: 'ground' | 'void'
  waterSurface?: number
}
type EdgeObservationRow = {
  [Key in keyof EdgeObservationRowFields]: EdgeObservationRowFields[Key]
}
interface EdgeObservationsRowsFields {
  north: EdgeObservationRow
  east: EdgeObservationRow
  south: EdgeObservationRow
  west: EdgeObservationRow
}
type EdgeObservationsRows = {
  [Key in keyof EdgeObservationsRowsFields]: EdgeObservationsRowsFields[Key]
}

/** PR6f1 (meta SHARD-COMPAT): what the cell's builder saw at one boundary, beside its rows. `geometry` says whether the
 *  edge stands on ground or drops to void; `waterSurface` is the open water's height there (0 is sea level). Engine's
 *  road strips read these; they never invent height at an entry. Optional: a file without them reads as before. */
const EdgeObservationSchema: GenericSchema<
  EdgeObservationRow,
  EdgeObservationRow
> = strictObject({
  geometry: exactOptional(geometry),
  waterSurface: exactOptional(water),
})
/** One observation per boundary, the same four sides as `edge`. */
const EdgeObservationsSchema: GenericSchema<
  EdgeObservationsRows,
  EdgeObservationsRows
> = strictObject({
  north: EdgeObservationSchema,
  east: EdgeObservationSchema,
  south: EdgeObservationSchema,
  west: EdgeObservationSchema,
})

export {
  EdgeObservationSchema,
  EdgeObservationsSchema,
  type EdgeObservationRow,
  type EdgeObservationsRows,
}
