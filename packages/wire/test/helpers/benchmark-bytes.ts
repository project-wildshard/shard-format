class ObservedBytes extends Uint8Array {
  private readonly observe: () => void
  public constructor(bytes: Readonly<Uint8Array>, observe: () => void) {
    super(bytes)
    this.observe = observe
  }
  public override at(index: number): number | undefined {
    this.observe()
    return super.at(index)
  }
}

export { ObservedBytes }
