import { GatewayTarget } from '@core/tenant/gateway-target';

/** One host the gateway knows, and the app it belongs to. */
export class TenantRoute {
  constructor(readonly host: string, readonly target: GatewayTarget, readonly tenantId: string | null) {}

  toJSON(): Record<string, unknown> {
    return { host: this.host, target: this.target.value, tenantId: this.tenantId };
  }

  static from(raw: unknown): TenantRoute | null {
    const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const host = String(input.host ?? '').trim().toLowerCase();
    const target = GatewayTarget.parse(input.target);
    if (!host || !target) return null;
    return new TenantRoute(host, target, input.tenantId ? String(input.tenantId) : null);
  }
}
