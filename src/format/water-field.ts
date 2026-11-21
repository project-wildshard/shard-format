import {
  finite,
  integer,
  maxValue,
  minValue,
  number,
  pipe,
  strictObject,
} from 'valibot'

import { ShardHashSchema } from './shardSections.ts'

import type { GenericSchema } from 'valibot'

const LIMIT = 250
const MIN_RES = 2
const MAX_RES = 2048
const MAX_SIZE = 1000

/**
 * ONE-FORMAT OF40b: the `water.field` primitive from a plain upload. A square f32 pond raster (`pond`: the hash of its
 * zlib block, `res` samples a side over `size` metres, centred on the cell) whose positive samples are water standing at
 * `level`, as Nalati's grass field's pond is. The bilinear sampling is the baked-terrain law.
 */
interface WaterFieldRows {
  level: number
  res: number
  size: number
  pond: string
}
const WaterFieldSchema: GenericSchema<WaterFieldRows, WaterFieldRows> =
  strictObject({
    level: pipe(number(), finite(), minValue(-LIMIT), maxValue(LIMIT)),
    res: pipe(number(), integer(), minValue(MIN_RES), maxValue(MAX_RES)),
    size: pipe(
      number(),
      finite(),
      minValue(Number.MIN_VALUE),
      maxValue(MAX_SIZE),
    ),
    pond: ShardHashSchema,
  })

export { WaterFieldSchema }
export type { WaterFieldRows }
