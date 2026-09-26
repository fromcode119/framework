import { describe, expect, it } from 'vitest';
import { RequestContextUtils } from '@core/context/request-context';
import { SiteContentRevision } from '@core/tenant/site-content-revision';

describe('SiteContentRevision', () => {
  it('moves one site on a site write, every site on a platform write', () => {
    const a0 = SiteContentRevision.current('site-a');
    const b0 = SiteContentRevision.current('site-b');
    SiteContentRevision.bump('site-a');
    expect(SiteContentRevision.current('site-a')).not.toBe(a0);
    expect(SiteContentRevision.current('site-b')).toBe(b0);
    const a1 = SiteContentRevision.current('site-a');
    SiteContentRevision.bump(null);
    expect(SiteContentRevision.current('site-a')).not.toBe(a1);
    expect(SiteContentRevision.current('site-b')).not.toBe(b0);
  });

  it('bumps the site the request is bound to, and nothing outside a site', () => {
    const before = SiteContentRevision.current('bound');
    const platform = SiteContentRevision.current(null);
    RequestContextUtils.storage.run({ tenantId: 'bound' } as any, () => SiteContentRevision.bumpCurrentSite());
    expect(SiteContentRevision.current('bound')).not.toBe(before);
    SiteContentRevision.bumpCurrentSite();
    expect(SiteContentRevision.current(null)).toBe(platform);
  });
});
