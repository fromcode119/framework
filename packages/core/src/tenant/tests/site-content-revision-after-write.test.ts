import { describe, expect, it } from 'vitest';
import { SiteContentRevision } from '@core/tenant/site-content-revision';
import { RequestContextUtils } from '@core/context/request-context';

describe('SiteContentRevision.afterWrite', () => {
  it('moves the site revision again once the write has landed, not only before it', async () => {
    await RequestContextUtils.storage.run({ tenantId: 'site-after-write' } as any, async () => {
      let release!: (value: string) => void;
      const write = new Promise<string>((resolve) => { release = resolve; });
      const tracked = SiteContentRevision.afterWrite(write);
      // A read made while the write is in flight carries this revision...
      const during = SiteContentRevision.current('site-after-write');
      release('row');
      expect(await tracked).toBe('row');
      // ...and must not be the revision once the write is visible.
      expect(SiteContentRevision.current('site-after-write')).not.toBe(during);
    });
  });

  it('passes a value that is not a promise straight through', () => {
    expect(SiteContentRevision.afterWrite(3)).toBe(3);
  });

  it('gives each process its own epoch prefix', () => {
    expect(SiteContentRevision.current(null)).toMatch(/^[a-z0-9]{9,}\.\d+\.\d+$/);
  });
});
