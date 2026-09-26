import { describe, expect, it } from 'vitest';
import { PluginHostOutage } from '@core/plugin/host/outage/plugin-host-outage';
import { PluginGuestHttp } from '@core/plugin/host/plugin-guest-http';

/** A request, a response that records what was sent, and whether `next` ran. */
class ExchangeFixture {
  status: number | null = null;
  body: any = null;
  passed = false;
  readonly res: any = { status: (code: number) => { this.status = code; return this.res; }, json: (body: unknown) => { this.body = body; return this.res; } };
  readonly next = () => { this.passed = true; };
}

describe('PluginHostOutage — a plugin whose process is not running', () => {
  const outage = new PluginHostOutage('billing', () => ['billing-wallets', 'fcp_billing_wallets'], () => 'extension-host unreachable');
  const middleware = `${PluginGuestHttp.MIDDLEWARE_PATH}/handler-1`;
  const run = (url: string, target?: string) => {
    const exchange = new ExchangeFixture();
    outage.handle({ originalUrl: url } as any, exchange.res, exchange.next, target);
    return exchange;
  };

  it("lets every request that is not the plugin's through its middleware — the platform keeps working", () => {
    // `/plugins/billing/runtime` is the PLATFORM's endpoint about the plugin — it must answer while it is down.
    for (const url of ['/api/v1/auth/me', '/api/v1/collections/pages', '/api/v1/plugins/other/health', '/api/v1/collections/billing-wallets-archive', '/api/v1/plugins/billing/runtime']) {
      const exchange = run(url, middleware);
      expect(exchange.passed, url).toBe(true);
      expect(exchange.status, url).toBeNull();
    }
  });

  it("refuses the plugin's own collections and routes, and says why", () => {
    for (const url of ['/api/v1/collections/billing-wallets', '/api/v1/collections/billing-wallets/7?depth=1', '/api/v1/collections/fcp_billing_wallets']) {
      const exchange = run(url, middleware);
      expect(exchange.passed, url).toBe(false);
      expect(exchange.status, url).toBe(503);
      expect(exchange.body.error).toBe('Plugin "billing" is not running: extension-host unreachable');
    }
    const route = run('/api/v1/plugins/billing/health');
    expect(route.status).toBe(503);
    expect(route.passed).toBe(false);
  });
});
