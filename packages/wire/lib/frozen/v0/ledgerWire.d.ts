import { type BitReader, type BitWriter } from './bits.ts';
/** What was granted: a declared fact, coins, or an item by its id. */
export type LedgerGrantKind = 'fact' | 'coins' | 'item';
/** One grant the server witnessed. `id` is stable: the same grant is the same id however often it is offered. */
export interface LedgerGrant {
    readonly id: string;
    readonly tick: number;
    readonly grant: LedgerGrantKind;
    readonly name: string;
    readonly amount: number; /** Not yet durable: a pending receipt may yet be retried, never repaid. */
    readonly pending: boolean;
}
/** A receipt for this client's own player (J105, J106): `serial` counts that player's grants, and a client applies each once. */
export interface NetLedger extends LedgerGrant {
    readonly kind: 'ledger';
    readonly serial: number;
}
/** Write a receipt after its event id. */
export declare function writeLedger(writer: BitWriter, event: NetLedger): void;
/** Read a receipt after its event id. */
export declare function readLedger(reader: BitReader): NetLedger;
