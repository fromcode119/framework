import { ComposeStack } from '@cli/services/deploy/compose-stack';

/**
 * Waits for the api to report a SPECIFIC version.
 *
 * "Answers 200" is not the test. A new image that crash-loops leaves the previous container serving,
 * and a deploy that accepted any healthy answer would call that a success — which is exactly how a
 * broken release stayed live until a person noticed Bad Gateway.
 */
export class ReleaseHealthProbe {
  static readonly API_PORT = 3000;

  private static readonly INTERVAL_MS = 5000;

  constructor(
    private readonly stack: ComposeStack,
    private readonly timeoutMs: number,
    private readonly sleep: (ms: number) => Promise<void> = ReleaseHealthProbe.wait,
  ) {}

  /** `v0.2.13` and `0.2.13` are the same release; the health endpoint reports the bare form. */
  static reports(body: string, version: string): boolean {
    return body.includes(`"version":"${version.replace(/^v/, '')}"`);
  }

  async waitFor(version: string): Promise<boolean> {
    const deadline = Date.now() + this.timeoutMs;
    while (Date.now() < deadline) {
      const body = await this.stack.health(ReleaseHealthProbe.API_PORT).catch(() => '');
      if (ReleaseHealthProbe.reports(body, version)) return true;
      await this.sleep(ReleaseHealthProbe.INTERVAL_MS);
    }
    return false;
  }

  private static wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
