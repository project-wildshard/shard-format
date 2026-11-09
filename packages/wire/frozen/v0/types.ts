// Frozen type-only boundary. No simulation or application runtime is imported.
export interface NetIdentity { readonly player: string; readonly name: string }
export interface QuestProgress { readonly quest: string; readonly started: boolean; readonly step: string | null; readonly n: number }
export interface DeathCause { kind: string; label: string; text?: string }
