// Validator output rows retain the format's mutable public data types.
/* oxlint-disable typescript/prefer-readonly-parameter-types */
import { parse, safeParse } from 'valibot'

import { parseSkinBindings, parseSkinRows } from './skinData.ts'
import {
  SKIN_LOOK_RECIPE,
  SKIN_CLIPS_RECIPE,
  SkinLookParametersSchema,
  SkinClipParametersSchema,
  ShardSkinFileSchema,
} from './skins.ts'

import type { ShardRows } from './rows.ts'
import type { SkinBinding, SkinRow } from './skinData.ts'
import type { SkinLookParameters } from './skins.ts'

/** Parse the exact skin look and animation parameters. */
function skinLookParameters(
  row: ShardRows['looks'][number],
): SkinLookParameters {
  if (row.recipe !== SKIN_LOOK_RECIPE) {
    throw new Error(`look ${row.id}: not a skin look`)
  }
  if (row.animation.recipe !== SKIN_CLIPS_RECIPE) {
    throw new Error(
      `look ${row.id}: a skin look animates with ${SKIN_CLIPS_RECIPE}`,
    )
  }
  const look = safeParse(SkinLookParametersSchema, row.parameters)
  const clips = safeParse(SkinClipParametersSchema, row.animation.parameters)
  if (!look.success || !clips.success) {
    throw new Error(`look ${row.id}: invalid skin parameters`)
  }
  return {
    skin: look.output.skin,
    attackSpan: clips.output.attackSpan,
    ...(row.animation.clipMap === undefined
      ? {}
      : { clipMap: row.animation.clipMap }),
    ...(look.output.variants === undefined
      ? {}
      : { variants: look.output.variants }),
    ...(look.output.phone === undefined ? {} : { phone: look.output.phone }),
    ...(look.output.phoneVariants === undefined
      ? {}
      : { phoneVariants: look.output.phoneVariants }),
  }
}

/** Decode the rig row and binding together. */
function parseSkinFile(bytes: Uint8Array): {
  row: SkinRow
  binding: SkinBinding
} {
  const file = parse(
    ShardSkinFileSchema,
    JSON.parse(new TextDecoder().decode(bytes)),
  )
  const [row] = parseSkinRows([file.row])
  if (row === undefined) {
    throw new Error('skin file: no row')
  }
  const [binding] = parseSkinBindings([file.binding], [row])
  if (binding === undefined) {
    throw new Error('skin file: no binding')
  }
  return { row, binding }
}

export { parseSkinFile, skinLookParameters }
