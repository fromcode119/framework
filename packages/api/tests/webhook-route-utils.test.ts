import { describe, expect, it } from 'vitest';
import { WebhookRouteUtils } from '@api/utils/webhook-route-utils';

/**
 * A plugin's webhook route (`/api/v1/plugins/<slug>/webhooks/<provider>`) must be treated like the
 * framework's own `/webhooks/...`: exempt from CSRF and served with the raw body. Before this, finance's
 * Stripe callback answered 403 "Invalid CSRF token" to Stripe.
 */
describe('WebhookRouteUtils.isWebhookPath', () => {
  it('matches the framework webhook root and its children', () => {
    expect(WebhookRouteUtils.isWebhookPath('/webhooks')).toBe(true);
    expect(WebhookRouteUtils.isWebhookPath('/webhooks/github')).toBe(true);
  });

  it('matches a plugin webhook route, with or without a provider segment', () => {
    expect(WebhookRouteUtils.isWebhookPath('/api/v1/plugins/finance/webhooks/stripe')).toBe(true);
    expect(WebhookRouteUtils.isWebhookPath('/api/v1/plugins/logistics-econt/webhooks')).toBe(true);
  });

  it('does not match other plugin routes or the admin webhook management pages', () => {
    expect(WebhookRouteUtils.isWebhookPath('/api/v1/plugins/finance/checkout/payment-session')).toBe(false);
    expect(WebhookRouteUtils.isWebhookPath('/api/v1/admin/webhooks/3/test')).toBe(false);
    expect(WebhookRouteUtils.isWebhookPath('')).toBe(false);
  });
});
