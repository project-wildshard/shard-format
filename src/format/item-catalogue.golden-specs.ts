/* oxlint-disable import/exports-last, typescript/explicit-function-return-type -- golden-vector oracle and fixtures (SDK-SPLIT SP4): written to match the engine side byte for byte */
// SDK-SPLIT SP4f3: how the golden vectors read item tables through the item catalogue. The engine's ItemCatalogue
// (the oracle, item-catalogue.golden-gen.mjs) and format's answer each table's every equipment, ammunition and inventory ask.
/** A named item table (the golden file carries its inputs: the corpus's and five shards' tables, read by the generator). */
export interface ItemTable {
  readonly name: string
  readonly table: unknown
}

interface Catalogue {
  readonly equipment: (id: string) => unknown
  readonly ammunition: (id: string) => ReadonlyMap<string, unknown>
  readonly inventory: unknown
}

/** One answer, or the refusal's message. */
function answer(run: () => unknown): unknown {
  try {
    const value = run()
    return { ok: value instanceof Map ? [...value.entries()] : value }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

/** Everything a table answers: each row's equipment and ammunition, the inventory policy and an unknown id. */
export function catalogueAnswers(
  make: (input: unknown) => Catalogue,
  table: unknown,
): unknown {
  const ids =
    typeof table === 'object' &&
    table !== null &&
    'rows' in table &&
    Array.isArray(table.rows)
      ? table.rows.flatMap((row: unknown) =>
          typeof row === 'object' &&
          row !== null &&
          'id' in row &&
          typeof row.id === 'string'
            ? [row.id]
            : [],
        )
      : []
  return answer(() => {
    const catalogue = make(table)
    return {
      rows: [...ids, 'item.missing'].map(id => [
        id,
        answer(() => catalogue.equipment(id)),
        answer(() => catalogue.ammunition(id)),
      ]),
      inventory: answer(() => catalogue.inventory),
    }
  })
}
