import { afterEach, describe, expect, it } from 'vitest';
import { CapabilityProviderRegistry } from '@core/plugin/capabilities/capability-provider-registry';

describe('CapabilityProviderRegistry', () => {
  afterEach(() => CapabilityProviderRegistry.reset());

  it('an unprovided capability answers with an empty list and no provider (not a crash)', () => {
    expect(CapabilityProviderRegistry.providersOf('payment.method')).toEqual([]);
    expect(CapabilityProviderRegistry.oneOf('payment.method')).toBeNull();
  });

  it('keeps every provider of a capability, highest priority first', () => {
    CapabilityProviderRegistry.provide({ capability: 'payment.method', slug: 'finance-payment-stripe', id: 'stripe', priority: 1 });
    CapabilityProviderRegistry.provide({ capability: 'payment.method', slug: 'finance-payment-mypos', id: 'mypos', priority: 5 });
    CapabilityProviderRegistry.provide({ capability: 'payment.method', slug: 'finance-payment-paypal', id: 'paypal' });

    expect(CapabilityProviderRegistry.providersOf('payment.method').map((p) => p.id)).toEqual(['mypos', 'stripe', 'paypal']);
    expect(CapabilityProviderRegistry.oneOf('payment.method')?.id).toBe('mypos');
  });

  it('re-providing the same (slug, id) replaces rather than duplicates', () => {
    CapabilityProviderRegistry.provide({ capability: 'tax.calculator', slug: 'finance', label: 'old' });
    CapabilityProviderRegistry.provide({ capability: 'tax.calculator', slug: 'finance', label: 'new' });
    const providers = CapabilityProviderRegistry.providersOf('tax.calculator');
    expect(providers).toHaveLength(1);
    expect(providers[0].label).toBe('new');
  });

  it('withdraw removes everything a disabled plugin provided', () => {
    CapabilityProviderRegistry.provide({ capability: 'payment.method', slug: 'finance-payment-mypos', id: 'mypos' });
    CapabilityProviderRegistry.provide({ capability: 'shipping.quote', slug: 'finance-payment-mypos', id: 'mypos-ship' });
    CapabilityProviderRegistry.provide({ capability: 'payment.method', slug: 'finance-payment-stripe', id: 'stripe' });

    CapabilityProviderRegistry.withdraw('finance-payment-mypos');

    expect(CapabilityProviderRegistry.providersOf('payment.method').map((p) => p.slug)).toEqual(['finance-payment-stripe']);
    expect(CapabilityProviderRegistry.providersOf('shipping.quote')).toEqual([]);
  });

  it('ignores a provider with no capability or no slug', () => {
    CapabilityProviderRegistry.provide({ capability: '', slug: 'x' } as never);
    CapabilityProviderRegistry.provide({ capability: 'y', slug: '' } as never);
    expect(CapabilityProviderRegistry.providersOf('y')).toEqual([]);
  });
});
