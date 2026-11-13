// The streaming validator's refusal when a check asks for bytes the stream
// did not hold (API-CLOUDFLARE AC6a2): a host never takes a guess for the
// check, and the corpus and pin tests prove no check does.

class StreamMissError extends Error {
  /** SHARD-AUTHORING SA41: the issue code (issue-codes.ts). */
  public readonly code = 'stream-miss'

  public constructor(message: string) {
    super(message)
    this.name = 'StreamMissError'
  }
}

export { StreamMissError }
