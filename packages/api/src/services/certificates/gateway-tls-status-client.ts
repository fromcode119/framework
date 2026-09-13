import { InternalServiceAuth, Logger, RouteConstants } from '@fromcode119/core';
import { GatewayReloadClient } from '@api/services/tenants/gateway-reload-client';

/**
 * Asks the platform's own edge whether it is actually terminating TLS.
 *
 * The admin must never imply that uploading a certificate put it on the wire. On a deployment whose
 * TLS is terminated by something else entirely, a stored certificate is stored and nothing more —
 * and an operator who uploads one, sees a green badge, and finds the site still broken has been
 * lied to by this product. So the screen states what the edge reports, and says plainly when nothing
 * here is serving these certificates.
 *
 * Best effort, like the reload it sits beside: no gateway configured, or one that does not answer,
 * is reported as "unknown" rather than turned into an error on a page about something else.
 */
export class GatewayTlsStatusClient {
  private static readonly TIMEOUT_MS = 3000;
  private readonly logger = new Logger({ namespace: 'gateway-tls-status' });

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  /** What the gateway says about itself, or null when it cannot be asked. */
  async read(): Promise<Record<string, unknown> | null> {
    const base = String(process.env[GatewayReloadClient.ENV_URL] || '').trim().replace(/\/+$/, '');
    if (!base) return null;
    try {
      const response = await this.fetchImpl(`${base}${RouteConstants.SEGMENTS.GATEWAY_HEALTH}`, {
        headers: InternalServiceAuth.requestHeaders(),
        signal: AbortSignal.timeout(GatewayTlsStatusClient.TIMEOUT_MS),
      });
      if (!response.ok) return null;
      return await response.json() as Record<string, unknown>;
    } catch (error: any) {
      this.logger.warn(`Gateway health unreachable: ${error?.message || error}`);
      return null;
    }
  }
}
