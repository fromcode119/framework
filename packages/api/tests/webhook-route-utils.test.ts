import { describe, expect, it } from 'vitest';
import { WebhookRouteUtils } from '@api/utils/webhook-route-utils';

/**
 * A plugin's webhook route (`/api/v1/plugins/<slug>/webhooks/<provider>`) must be treated like the
 * framework's own `/webhooks/...`: exempt from CSRF and served with the raw body. Before this, gamma's
 * Stripe callback answered 403 "Invalid CSRF token" to Stripe.
 */
describe('WebhookRouteUtils.isWebhookPath', () => {
  it('matches the framework webhook root and its children', () => {
    expect(WebhookRouteUtils.isWebhookPath('/webhooks')).toBe(true);
    expect(WebhookRouteUtils.isWebhookPath('/webhooks/github')).toBe(true);
  });

  it('matches a plugin webhook route, with or without a provider segment', () => {
    expect(WebhookRouteUtils.isWebhookPath('/api/v1/plugins/gamma/webhooks/stripe')).toBe(true);
    expect(WebhookRouteUtils.isWebhookPath('/api/v1/plugins/delta-shipping/webhooks')).toBe(true);
  });

  it('does not match other plugin routes or the admin webhook management pages', () => {
    expect(WebhookRouteUtils.isWebhookPath('/api/v1/plugins/gamma/checkout/payment-session')).toBe(false);
    expect(WebhookRouteUtils.isWebhookPath('/api/v1/admin/webhooks/3/test')).toBe(false);
    expect(WebhookRouteUtils.isWebhookPath('')).toBe(false);
  });
});

/**
 * The bytes a webhook's signature covers must survive BOTH body parsers. myPOS posts its notifications
 * as a form; with only the JSON parser keeping them, the plugin proxy re-sent the parsed form as JSON
 * and the provider's signature could never verify.
 */
describe('WebhookRouteUtils.keepRawBody', () => {
  const run = async (path: string, contentType: string, body: string) => {
    const express = (await import('express')).default;
    const app = express();
    app.use(express.json({ verify: WebhookRouteUtils.keepRawBody }));
    app.use(express.urlencoded({ extended: true, verify: WebhookRouteUtils.keepRawBody }));
    app.post(/.*/, (req: any, res) => res.json({ raw: req.rawBody ? req.rawBody.toString('utf8') : null, parsed: req.body }));
    const server = app.listen(0);
    try {
      const { port } = server.address() as { port: number };
      const response = await fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', headers: { 'content-type': contentType }, body });
      return await response.json();
    } finally {
      server.close();
    }
  };

  it('keeps the exact bytes of a FORM posted to a plugin webhook', async () => {
    const body = 'IPCmethod=IPCPurchaseNotify&Amount=42.50&OrderID=MPS-1&Signature=a%2Bb%3D';

    const result = await run('/api/v1/plugins/example-plugin/webhooks/example-provider', 'application/x-www-form-urlencoded', body);

    expect(result.raw).toBe(body);
    expect(result.parsed.Signature).toBe('a+b=');
  });

  it('keeps the exact bytes of a JSON webhook, whitespace included', async () => {
    const body = '{ "id" : "evt_1" }';

    expect((await run('/api/v1/plugins/example-plugin/webhooks/another-provider', 'application/json', body)).raw).toBe(body);
  });

  it('keeps nothing for a request that is not a webhook', async () => {
    expect((await run('/api/v1/plugins/example-plugin/checkout/payment-session', 'application/x-www-form-urlencoded', 'a=1')).raw).toBeNull();
  });
});

describe('browser security reports', () => {
  const req = (path: string, type: string) => ({ path, headers: { 'content-type': type } });

  it('are parsed on a plugin webhook path, under either report media type', () => {
    expect(WebhookRouteUtils.isReportBody(req('/api/v1/plugins/security/webhooks/csp-report', 'application/csp-report'))).toBe(true);
    expect(WebhookRouteUtils.isReportBody(req('/api/v1/plugins/security/webhooks/csp-report', 'application/reports+json; charset=utf-8'))).toBe(true);
  });

  it('are never parsed off a webhook path, where a cross-site post would carry the session', () => {
    expect(WebhookRouteUtils.isReportBody(req('/api/v1/plugins/security/settings', 'application/csp-report'))).toBe(false);
    expect(WebhookRouteUtils.isReportBody(req('/api/v1/auth/logout', 'application/reports+json'))).toBe(false);
  });

  it('leave every other media type to the ordinary parsers', () => {
    expect(WebhookRouteUtils.isReportBody(req('/api/v1/plugins/security/webhooks/csp-report', 'application/json'))).toBe(false);
    expect(WebhookRouteUtils.isReportBody(req('/api/v1/plugins/security/webhooks/csp-report', 'text/plain'))).toBe(false);
  });
});
