import type { ClassColumns } from './columns.ts';
import type { SpawnColumns } from './event-stream.ts';
/** The spawn's tail: `initial` words and `text` strings, in sender order. */
interface SpawnTail {
    readonly initial: readonly number[];
    readonly text: readonly string[];
}
/** Spawn columns by the sender's classes, keyed by class id. */
declare function spawnColumns(classOf: (id: number) => ClassColumns | undefined): SpawnColumns;
export { spawnColumns, type SpawnTail };
