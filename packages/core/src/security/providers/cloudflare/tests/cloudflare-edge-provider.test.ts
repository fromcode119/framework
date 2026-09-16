import { CloudflareEdgeProvider } from '@core/security/providers/cloudflare/cloudflare-edge-provider';
import { NetworkEdgeProviderRegistry } from '@core/security/providers/network-edge-provider-registry';

describe('CloudflareEdgeProvider', () => {
  it('declares its own key and trusted header, not a hardcoded one shared with other providers', () => {
    const provider = new CloudflareEdgeProvider();
    expect(provider.key).toBe('cloudflare');
    expect(provider.trustedIpHeader).toBe('cf-connecting-ip');
  });

  it('ships its published edge ranges as [address, prefix] tuples', () => {
    const provider = new CloudflareEdgeProvider();
    expect(provider.defaultRanges.length).toBeGreaterThan(0);
    for (const [address, prefix] of provider.defaultRanges) {
      expect(typeof address).toBe('string');
      expect(typeof prefix).toBe('number');
    }
  });
});

describe('NetworkEdgeProviderRegistry', () => {
  it('registers Cloudflare today, so adding a second provider is one more entry here', () => {
    expect(NetworkEdgeProviderRegistry.ALL.map((provider) => provider.key)).toContain('cloudflare');
  });

  it('finds a registered provider by key', () => {
    expect(NetworkEdgeProviderRegistry.byKey('cloudflare')?.trustedIpHeader).toBe('cf-connecting-ip');
  });

  it('returns undefined for an unregistered key', () => {
    expect(NetworkEdgeProviderRegistry.byKey('not-a-real-provider')).toBeUndefined();
  });

  it('renders a provider\'s default ranges as comma-separated CIDR text', () => {
    const text = NetworkEdgeProviderRegistry.rangesTextFor(new CloudflareEdgeProvider());
    expect(text).toContain('104.16.0.0/13');
    expect(text.split(', ').length).toBe(new CloudflareEdgeProvider().defaultRanges.length);
  });
});
