export class ReflectionRequestLifecycle {
  private version = 0;
  private controller: AbortController | null = null;

  begin(): { version: number; signal: AbortSignal } {
    this.cancel();
    this.controller = new AbortController();
    return { version: this.version, signal: this.controller.signal };
  }

  cancel(): void {
    this.version += 1;
    this.controller?.abort();
    this.controller = null;
  }

  isCurrent(version: number): boolean {
    return version === this.version && this.controller !== null;
  }

  finish(version: number): void {
    if (this.isCurrent(version)) this.controller = null;
  }
}
