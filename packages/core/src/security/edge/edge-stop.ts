import { NetworkAddressUtils } from '@core/security/network-address-utils';

/**
 * One address the gateway must refuse until a moment: a stop the gateway made itself and the api
 * recorded (Settings → Security → Stopped addresses). Carried in the routing map, so a stop outlives a
 * gateway restart and an operator's "Release" reaches every gateway at its next fetch.
 */
export class EdgeStop {
  constructor(readonly address: string, readonly until: number) {}

  toJSON(): Record<string, unknown> {
    return { address: this.address, until: new Date(this.until).toISOString() };
  }

  static fromJson(raw: unknown): EdgeStop | null {
    const value = (raw ?? {}) as Record<string, unknown>;
    const address = NetworkAddressUtils.subscriber(value.address);
    const until = Date.parse(String(value.until ?? ''));
    return address && Number.isFinite(until) ? new EdgeStop(address, until) : null;
  }

  static listFromJson(raw: unknown): EdgeStop[] {
    return (Array.isArray(raw) ? raw : []).map((entry) => EdgeStop.fromJson(entry)).filter((stop): stop is EdgeStop => stop !== null);
  }
}
