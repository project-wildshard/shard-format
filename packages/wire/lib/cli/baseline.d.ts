/** Rebuild the v0 lock from frozen declarations, preserving field order. */
declare function baselineLockText(): string;
/** WS2 only: no v1 compatibility or release classification is claimed. */
declare function checkBaseline(): Promise<void>;
export { baselineLockText, checkBaseline };
