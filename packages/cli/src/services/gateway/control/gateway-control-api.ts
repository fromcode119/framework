import { ApiPathUtils, InternalServiceAuth } from '@fromcode119/core';

/**
 * The gateway asking the api about edges, with the internal secret. Never throws: an api that cannot be
 * reached answers as `{ status: 0 }`, which every caller treats as a refusal — the channel fails closed.
 */
export class GatewayControlApi {
  private static readonly TIMEOUT_MS = 5_000;

  constructor(
    private readonly apiBase: string = String(process.env.API_TARGET_URL || 'http://api:3000'),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  get enabled(): boolean {
    return InternalServiceAuth.isConfigured();
  }

  async post(segment: string, body: Record<string, unknown>): Promise<{ status: number; body: Record<string, any> }> {
    if (!this.enabled) return { status: 0, body: {} };
    try {
      const response = await this.fetchImpl(`${this.apiBase.replace(/\/+$/, '')}${ApiPathUtils.versioned(segment)}`, {
        method: 'POST',
        headers: { ...InternalServiceAuth.requestHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(GatewayControlApi.TIMEOUT_MS),
      });
      const parsed = await response.json().catch(() => ({}));
      return { status: response.status, body: parsed && typeof parsed === 'object' ? parsed as Record<string, any> : {} };
    } catch (error: any) {
      console.warn(`[platform-gateway] control: the api could not be asked (${segment}): ${error?.message || error}`);
      return { status: 0, body: {} };
    }
  }
}
