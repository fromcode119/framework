import { EdgeX509, RouteConstants } from '@fromcode119/core';
import { GatewayControlApi } from '@cli/services/gateway/control/gateway-control-api';

/**
 * The certificate the gateway's control listener presents, issued by the platform's edge authority for
 * the configured control address. The key is made here and never leaves the process; only a request
 * for it goes to the api. Renewed at half its life, retried every {@link RETRY_MS} until it is issued.
 */
export class GatewayControlIdentity {
  private static readonly RETRY_MS = 30_000;
  private current: { key: string; cert: string; ca: string; notAfter: number; address: string } | null = null;
  private timer: NodeJS.Timeout | null = null;
  private pending: Promise<void> | null = null;
  private issuedAt = 0;

  constructor(
    private readonly api: GatewayControlApi,
    private readonly onChange: () => void,
    private readonly now: () => number = Date.now,
  ) {}

  /** Key, chain and the trust bundle edges are checked against; null until the first issue. */
  get material(): { key: string; cert: string; ca: string } | null {
    return this.current;
  }

  /** Makes sure there is a current certificate for `address`, issuing one when it is missing, for another address, or past half its life. */
  ensure(address: string): Promise<void> {
    const current = this.current;
    if (current && current.address === address && this.now() < current.notAfter - (current.notAfter - this.issuedAt) / 2) return Promise.resolve();
    this.pending ??= this.issue(address).finally(() => { this.pending = null; });
    return this.pending;
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private async issue(address: string): Promise<void> {
    const keys = await EdgeX509.generateKeyPair();
    const request = await EdgeX509.request(address, keys);
    const answer = await this.api.post(RouteConstants.SEGMENTS.INTERNAL_EDGE_CONTROL_CERTIFICATE, { request });
    const notAfter = Date.parse(String(answer.body.notAfter ?? ''));
    if (answer.status !== 200 || !answer.body.certificatePem || !Number.isFinite(notAfter)) {
      console.warn(`[platform-gateway] control: no certificate for ${address} yet (HTTP ${answer.status}); retrying in ${GatewayControlIdentity.RETRY_MS / 1000} s`);
      this.schedule(address, GatewayControlIdentity.RETRY_MS);
      return;
    }
    this.issuedAt = this.now();
    this.current = { key: await EdgeX509.exportPrivateKey(keys.privateKey), cert: `${answer.body.certificatePem}${answer.body.chainPem}`, ca: String(answer.body.trustPem), notAfter, address };
    this.schedule(address, Math.max(1_000, (notAfter - this.issuedAt) / 2));
    this.onChange();
  }

  private schedule(address: string, delayMs: number): void {
    this.stop();
    this.timer = setTimeout(() => { this.timer = null; void this.ensure(address); }, delayMs);
    this.timer.unref?.();
  }
}
