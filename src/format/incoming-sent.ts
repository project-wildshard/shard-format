/** FORMAT-PRUNE FP60: what an incoming original's index carried before `incoming.ts` mended it. A published client
 * declared its hashes (the source hash, the cook preparation's input hash) over the index as it sent it, `requires.sdk`
 * included, so each check also accepts the index as sent. A leaf: `outputIndex.ts` reaches the preparation check, and
 * this imports nothing. */

/** Each parsed incoming index whose `requires.sdk` was mended away, with the value the client sent. */
const SENT_SDK = new WeakMap<object, unknown>()

/** Remember the `requires.sdk` the client sent with `index`. */
function rememberSentSdk(index: object, sdk: unknown): void {
  SENT_SDK.set(index, sdk)
}

/** The `requires.sdk` the client sent with `index`, when it was mended away. */
function sentSdkOf(index: object): unknown {
  return SENT_SDK.get(index)
}

/** `value` with the `requires.sdk` its client sent. */
function withSentSdk(
  value: Readonly<{ requires?: object }>,
  sdk: unknown,
): object {
  return { ...value, requires: { ...value.requires, sdk } }
}

/** `value` as checked, then, when its client sent a `requires.sdk` that was mended away, as the client hashed it. */
function sentForms(
  value: Readonly<{ requires?: object }>,
  index: object,
): readonly object[] {
  const sdk = SENT_SDK.get(index)
  return sdk === undefined ? [value] : [value, withSentSdk(value, sdk)]
}

export { rememberSentSdk, sentForms, sentSdkOf }
