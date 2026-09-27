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

  /**
   * The api reports `version` AND the platform answers on its public address.
   *
   * The api alone is not the test either: 0.2.210 reported itself healthy from inside its container
   * while no container published ports 80 and 443, and the deploy printed "is serving" over a minute
   * in which every site answered 521.
   */
  async waitFor(version: string): Promise<boolean> {
    const deadline = Date.now() + this.timeoutMs;
    let reported = false;
    let address: string | null = null;
    let status = '';
    while (Date.now() < deadline) {
      if (!reported) reported = ReleaseHealthProbe.reports(await this.stack.health(ReleaseHealthProbe.API_PORT).catch(() => ''), version);
      if (reported) {
        address = await this.stack.publicAddress();
        status = address ? await this.stack.publicStatus(address) : '';
        if (address && status !== '000') return true;
      }
      await this.sleep(ReleaseHealthProbe.INTERVAL_MS);
    }
    if (reported) console.error(address
      ? `The api reports ${version}, but the platform does not answer on ${address}.`
      : `The api reports ${version}, but neither the edge nor the gateway publishes a port.`);
    return false;
  }

  private static wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
