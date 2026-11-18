import { afterEach, describe, expect, it } from 'vitest';
import { CapabilityProviderRegistry } from '@core/plugin/capabilities/capability-provider-registry';

describe('CapabilityProviderRegistry', () => {
  afterEach(() => CapabilityProviderRegistry.reset());

  it('an unprovided capability answers with an empty list and no provider (not a crash)', () => {
    expect(CapabilityProviderRegistry.providersOf('payment.method')).toEqual([]);
    expect(CapabilityProviderRegistry.oneOf('payment.method')).toBeNull();
  });

  it('keeps every provider of a capability, highest priority first', () => {
    CapabilityProviderRegistry.provide({ capability: 'payment.method', slug: 'sample-pay-a', id: 'pay-a', priority: 1 });
    CapabilityProviderRegistry.provide({ capability: 'payment.method', slug: 'sample-pay-b', id: 'pay-b', priority: 5 });
    CapabilityProviderRegistry.provide({ capability: 'payment.method', slug: 'sample-pay-c', id: 'pay-c' });

    expect(CapabilityProviderRegistry.providersOf('payment.method').map((p) => p.id)).toEqual(['pay-b', 'pay-a', 'pay-c']);
    expect(CapabilityProviderRegistry.oneOf('payment.method')?.id).toBe('pay-b');
  });

  it('re-providing the same (slug, id) replaces rather than duplicates', () => {
    CapabilityProviderRegistry.provide({ capability: 'tax.calculator', slug: 'sample-finance', label: 'old' });
    CapabilityProviderRegistry.provide({ capability: 'tax.calculator', slug: 'sample-finance', label: 'new' });
    const providers = CapabilityProviderRegistry.providersOf('tax.calculator');
    expect(providers).toHaveLength(1);
    expect(providers[0].label).toBe('new');
  });

  it('withdraw removes everything a disabled plugin provided', () => {
    CapabilityProviderRegistry.provide({ capability: 'payment.method', slug: 'sample-pay-b', id: 'pay-b' });
    CapabilityProviderRegistry.provide({ capability: 'shipping.quote', slug: 'sample-pay-b', id: 'pay-b-ship' });
    CapabilityProviderRegistry.provide({ capability: 'payment.method', slug: 'sample-pay-a', id: 'pay-a' });

    CapabilityProviderRegistry.withdraw('sample-pay-b');

    expect(CapabilityProviderRegistry.providersOf('payment.method').map((p) => p.slug)).toEqual(['sample-pay-a']);
    expect(CapabilityProviderRegistry.providersOf('shipping.quote')).toEqual([]);
  });

  it('clamps a self-declared priority so no plugin can force itself to the top with an absurd value', () => {
    CapabilityProviderRegistry.provide({ capability: 'payment.method', slug: 'greedy', priority: Number.MAX_SAFE_INTEGER });
    expect(CapabilityProviderRegistry.oneOf('payment.method')?.priority).toBeLessThanOrEqual(100);
  });

  it('returns copies, so a consumer cannot mutate the shared registry', () => {
    CapabilityProviderRegistry.provide({ capability: 'tax.calculator', slug: 'sample-finance' });
    const got = CapabilityProviderRegistry.providersOf('tax.calculator')[0];
    (got as { slug: string }).slug = 'attacker';
    expect(CapabilityProviderRegistry.providersOf('tax.calculator')[0].slug).toBe('sample-finance');
  });

  it('ignores a provider with no capability or no slug', () => {
    CapabilityProviderRegistry.provide({ capability: '', slug: 'x' } as never);
    CapabilityProviderRegistry.provide({ capability: 'y', slug: '' } as never);
    expect(CapabilityProviderRegistry.providersOf('y')).toEqual([]);
  });
});
