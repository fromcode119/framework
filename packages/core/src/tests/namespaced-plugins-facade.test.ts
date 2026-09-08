import { describe, expect, it } from 'vitest';

import { NamespacedPluginsFacade } from '@core/namespaced-plugins-facade';

describe('NamespacedPluginsFacade', () => {
  const namespace = 'org.fromcode';
  const financeApi = {
    async getCapabilities() {
      return {
        walletsEnabled: true,
        operations: {
          resolveCheckoutAdjustments: true,
        },
      };
    },
    async resolveCheckoutAdjustments() {
      return { success: true, payableAmount: 10 };
    },
  };
  const resolver = {
    has(targetNamespace: string, slug: string) {
      return targetNamespace === namespace && slug === 'gamma';
    },
    resolve(targetNamespace: string, slug: string) {
      return targetNamespace === namespace && slug === 'gamma' ? financeApi : null;
    },
  };

  it('returns null from call when the plugin method is unavailable', async () => {
    const facade = new NamespacedPluginsFacade(resolver, namespace);

    await expect(facade.call('gamma', 'missingMethod')).resolves.toBeNull();
  });

  it('calls plugin methods without requiring an inline api shape', async () => {
    const facade = new NamespacedPluginsFacade(resolver, namespace);

    await expect(facade.call<{ walletsEnabled: boolean }>('gamma', 'getCapabilities')).resolves.toEqual({
      walletsEnabled: true,
      operations: { resolveCheckoutAdjustments: true },
    });
    await expect(facade.getCapabilities('gamma')).resolves.toEqual({
      walletsEnabled: true,
      operations: { resolveCheckoutAdjustments: true },
    });
    expect(facade.hasMethod('gamma', 'getCapabilities')).toBe(true);
  });

  it('uses advertised operations instead of raw method probing', async () => {
    const facade = new NamespacedPluginsFacade(resolver, namespace);

    await expect(facade.getOperations('gamma')).resolves.toEqual({ resolveCheckoutAdjustments: true });
    await expect(facade.supportsOperation('gamma', 'resolveCheckoutAdjustments')).resolves.toBe(true);
    await expect(facade.callOperation('gamma', 'resolveCheckoutAdjustments')).resolves.toEqual({ success: true, payableAmount: 10 });
    await expect(facade.callOperation('gamma', 'missingOperation')).resolves.toBeNull();
  });

  it('throws when a required plugin method is missing', () => {
    const facade = new NamespacedPluginsFacade(resolver, namespace);

    expect(() => facade.requireMethod('gamma', 'missingMethod')).toThrow('does not expose method');
  });
});