/** AUDIO AU18 (J304): one music style per shard. The engine ships one style (piano), and its manifest has these slots
 *  beside `title`. A score names the engine music it plays by slot, and the engine cook derives the hashed files from
 *  these names, so an engine re-encode never needs a new shard revision. */
const ENGINE_MUSIC_SLOTS: readonly string[] = ['island', 'pine']
const ENGINE_SLOTS_MESSAGE =
  'a slot played from the engine style (set base, or unset) is title, island or pine (J304)'

/** The score rows that name engine music. */
interface EngineMusicRows {
  readonly slots: readonly string[]
  readonly bootSlots: readonly string[]
  readonly sets: Readonly<Record<string, string>>
  readonly setCatalogue?: unknown
}

/** The engine slots a score plays: `title` when it boots one, and each slot whose set is `base` (unset means `base`).
 *  A set-catalogue score plays only its own `source` beside the title. */
function engineMusicSlots(music: Readonly<EngineMusicRows>): string[] {
  const base =
    music.setCatalogue === undefined
      ? music.slots.filter(
          (slot): boolean => (music.sets[slot] ?? 'base') === 'base',
        )
      : []
  const title = music.bootSlots.includes('title') ? ['title'] : []
  return [...new Set([...title, ...base])]
}

/** Every engine slot the score plays is one the engine's style has. */
function engineSlotsKnown(music: Readonly<EngineMusicRows>): boolean {
  return engineMusicSlots(music).every(
    (slot): boolean => slot === 'title' || ENGINE_MUSIC_SLOTS.includes(slot),
  )
}

export {
  ENGINE_MUSIC_SLOTS,
  ENGINE_SLOTS_MESSAGE,
  engineMusicSlots,
  engineSlotsKnown,
}
export type { EngineMusicRows }
