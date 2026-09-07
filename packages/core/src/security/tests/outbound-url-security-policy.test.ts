import { describe, expect, it, vi } from 'vitest';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async (hostname: string) => {
    if (hostname === 'public.example') return [{ address: '8.8.8.8', family: 4 }];
    if (hostname === 'mixed.example') return [
      { address: '8.8.8.8', family: 4 },
      { address: '172.18.0.3', family: 4 },
    ];
    throw new Error('not found');
  }),
}));

import { OutboundUrlSecurityPolicy } from '@core/security/outbound-url-security-policy';

describe('OutboundUrlSecurityPolicy', () => {
  it('allows HTTP targets only when every resolved address is public', async () => {
    expect(await OutboundUrlSecurityPolicy.isPublicHttpUrl('https://public.example/page')).toBe(true);
    expect(await OutboundUrlSecurityPolicy.isPublicHttpUrl('https://mixed.example/page')).toBe(false);
  });

  it('rejects local addresses, credentials, unsupported schemes, and lookup failures', async () => {
    expect(await OutboundUrlSecurityPolicy.isPublicHttpUrl('http://127.0.0.1')).toBe(false);
    expect(await OutboundUrlSecurityPolicy.isPublicHttpUrl('https://user:pass@public.example')).toBe(false);
    expect(await OutboundUrlSecurityPolicy.isPublicHttpUrl('file:///etc/passwd')).toBe(false);
    expect(await OutboundUrlSecurityPolicy.isPublicHttpUrl('https://missing.example')).toBe(false);
  });
});
