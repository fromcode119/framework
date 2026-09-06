import { InternalServiceAuth, Logger, RouteConstants } from '@fromcode119/core';

/**
 * Tells the platform gateway that the tenant table changed, so a site created or renamed on the Sites
 * page routes within a second instead of at the gateway's next refresh. Best effort by design: the
 * gateway also refreshes on its own timer, and a gateway that is not running (single-domain mode,
 * local dev without one) must never turn a tenant change into an error.
 */
export class GatewayReloadClient {
  static readonly ENV_URL = 'GATEWAY_INTERNAL_URL';
  static readonly RELOAD_PATH = RouteConstants.SEGMENTS.INTERNAL_ROUTING_RELOAD;
  private static readonly TIMEOUT_MS = 3000;
  private readonly logger = new Logger({ namespace: 'gateway-reload' });

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async notify(): Promise<boolean> {
    const base = String(process.env[GatewayReloadClient.ENV_URL] || '').trim().replace(/\/+$/, '');
    if (!base || !InternalServiceAuth.isConfigured()) return false;
    try {
      const response = await this.fetchImpl(`${base}${GatewayReloadClient.RELOAD_PATH}`, {
        method: 'POST',
        headers: InternalServiceAuth.requestHeaders(),
        signal: AbortSignal.timeout(GatewayReloadClient.TIMEOUT_MS),
      });
      if (!response.ok) this.logger.warn(`Gateway did not accept the routing reload: HTTP ${response.status}`);
      return response.ok;
    } catch (error: any) {
      this.logger.warn(`Gateway routing reload failed: ${error?.message || error}`);
      return false;
    }
  }
}
