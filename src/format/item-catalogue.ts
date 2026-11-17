/* oxlint-disable capitalized-comments, curly, import/exports-last, import/group-exports, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-member-accessibility, typescript/prefer-readonly-parameter-types, unicorn/consistent-function-scoping -- verbatim port of the engine's law (SDK-SPLIT SP4); golden vectors pin it, so it keeps the engine's form */
/**
 * SDK-SPLIT SP4f3 (Q35): the item catalogue reader moved from engine `shared/game/loadout/itemCatalogue.ts`, with the
 * portable equipment and ammunition vocabulary it returns. The shard-augmented maps (`EquipmentSlotMap`,
 * `EquipmentIconMap`) stay in the engine, which fills them by declaration merging and narrows these rows to its own.
 */
import { parseItems } from './items.ts'

/** a sound cue's id */
export type CueId = `cue.${string}`
export type ToolId = `tool.${string}`
export type EquipmentId = `weapon.${string}` | ToolId
export type AmmoId = `ammo.${string}`
/** a weapon's sound cues: fire, reload, impact, and the optional dry, hit, heavy and charge cues */
export interface EquipmentCues {
  fire: CueId
  reload: CueId
  impact: CueId
  dry?: CueId
  hit?: CueId
  heavy?: CueId
  charge?: Readonly<Record<string, CueId>>
}

type ItemRow = ReturnType<typeof parseItems>['rows'][number]
type ItemEquipment = NonNullable<ItemRow['equipment']>
/** An item's portable equipment presentation: its admitted row, with the engine's equipment id and cue ids. */
export type ItemEquipmentRow = Omit<ItemEquipment, 'id' | 'cues'> & {
  id: EquipmentId
  cues?: EquipmentCues
}
/** An ammunition's portable row (the engine's `AmmoRow`): its flight, wet flight increments applied, and tags. */
export interface ItemAmmoRow {
  id: AmmoId
  label: string
  name: string
  flight: { gravity: number; drag: number }
  wet?: { gravity: number; drag: number }
  tags: readonly string[]
  material?: string
  pouchMax: number
}

/** One admitted item catalogue for equipment, ammunition and native inventory.
 * Pine, Driftwood, Nalati and Nine share this metadata reader; no state, clock or callback is installed. */
export class ItemCatalogue {
  private readonly items: ReturnType<typeof parseItems>
  constructor(input: unknown) {
    this.items = parseItems(input)
  }
  /** Resolve admitted equipment metadata without factories, callbacks or a second state owner.
   * Native constructors keep their profile and pickup service; this supplies only portable presentation. */
  equipment(id: string): ItemEquipmentRow {
    const item = this.items.rows.find(row => row.id === id)
    if (item?.equipment === undefined)
      throw new Error(`Missing declared equipment presentation: ${id}`)
    const { id: equipmentId, cues, ...presentation } = item.equipment
    const cueId = (value: string): `cue.${string}` => `cue.${value.slice(4)}`
    return {
      ...presentation,
      id:
        item.kind === 'weapon'
          ? `weapon.${equipmentId.slice(7)}`
          : `tool.${equipmentId.slice(5)}`,
      ...(cues === undefined
        ? {}
        : {
            cues: {
              fire: cueId(cues.fire),
              reload: cueId(cues.reload),
              impact: cueId(cues.impact),
              ...(cues.dry === undefined ? {} : { dry: cueId(cues.dry) }),
              ...(cues.hit === undefined ? {} : { hit: cueId(cues.hit) }),
              ...(cues.heavy === undefined ? {} : { heavy: cueId(cues.heavy) }),
              ...(cues.charge === undefined
                ? {}
                : {
                    charge: Object.fromEntries(
                      Object.entries(cues.charge).map(([phase, value]) => [
                        phase,
                        cueId(value),
                      ]),
                    ),
                  }),
            },
          }),
    }
  }

  /** Page ammunition borrows the same admitted flight/target coefficients as native projectiles.
   * The returned rows retain the weather convention (absolute wet multipliers) and carry no effects or clocks. */
  ammunition(id: string): ReadonlyMap<
    string,
    {
      row: ItemAmmoRow
      damage: {
        readonly default: number
        readonly kinds: Readonly<Record<string, number>>
      }
    }
  > {
    const item = this.items.rows.find(row => row.id === id)
    if (item?.kind !== 'weapon' || item.ranged === undefined)
      throw new Error('Missing declared ammunition')
    return new Map(
      item.ranged.ammunition.map(ammo => {
        if (ammo.presentation === undefined)
          throw new Error('Missing declared ammunition presentation')
        const ammoId = `ammo.${ammo.id}` as const
        return [
          ammo.id,
          {
            row: {
              id: ammoId,
              ...ammo.presentation,
              flight: { ...ammo.flight },
              tags: [ammoId],
              ...(ammo.wet === undefined
                ? {}
                : {
                    wet: {
                      gravity: 1 + ammo.wet.gravity,
                      drag: 1 + ammo.wet.drag,
                    },
                  }),
            },
            damage: {
              default: 1,
              kinds: Object.fromEntries(
                ammo.targets.map(kind => [kind, ammo.damage]),
              ),
            },
          },
        ]
      }),
    )
  }

  /** Read the admitted saved-pack policy; NativeInventory remains the only stacking/trade state owner. */
  get inventory(): NonNullable<
    ReturnType<typeof parseItems>['loadout']['inventory']
  > {
    const profile = this.items.loadout.inventory
    if (profile === undefined)
      throw new Error('Missing declared inventory policy')
    return profile
  }
}
