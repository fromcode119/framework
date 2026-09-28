import { describe, expect, it, vi } from 'vitest';
import { CertificateAdminService } from '@api/services/certificates/certificate-admin-service';

/**
 * Saving a site's Cloudflare token is the fix for its hosts that failed on the old one. Before this,
 * they sat out their wait with the old error on screen and nothing said a retry would ever happen —
 * so the save looked like it did nothing. Clearing the token must not requeue anything.
 */
const serviceWith = (requeued: string[]) => {
  const certificates = { requeueFailedDns01: vi.fn(async () => requeued) };
  const tokens = { set: vi.fn(async () => undefined), readCiphertext: vi.fn(async (tenantId: string | null) => (tenantId ? 'enc:v1:site' : '')) };
  const service = new CertificateAdminService(certificates as never, {} as never, tokens as never, { notify: vi.fn() } as never, {} as never);
  return { service, certificates, tokens };
};

describe('saving a Cloudflare token', () => {
  it('requeues the site\'s failed DNS-01 hosts and names them', async () => {
    const { service, certificates } = serviceWith(['shop.test']);
    const result = await service.setCloudflareToken('new-token', 'shop');

    expect(certificates.requeueFailedDns01).toHaveBeenCalledWith('shop');
    expect(result.requeuedHosts).toEqual(['shop.test']);
    expect(result.isCloudflareConfigured).toBe(true);
  });

  it('requeues nothing when the token is cleared', async () => {
    const { service, certificates } = serviceWith(['shop.test']);
    const result = await service.setCloudflareToken('', 'shop');

    expect(certificates.requeueFailedDns01).not.toHaveBeenCalled();
    expect(result.requeuedHosts).toEqual([]);
  });
});
