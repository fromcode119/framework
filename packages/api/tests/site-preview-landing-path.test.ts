import { describe, expect, it } from 'vitest';
import { SitePreviewLandingPath } from '@api/services/tenants/site-preview-landing-path';

describe('SitePreviewLandingPath', () => {
  it('keeps a path on the site, query included', () => {
    expect(SitePreviewLandingPath.normalize('/blog/a-draft?preview=1')).toBe('/blog/a-draft?preview=1');
    expect(SitePreviewLandingPath.normalize('/')).toBe('/');
  });

  it('sends anything that could leave the site to the home page', () => {
    // The exchange redirects to this value for whoever holds the link: an open redirect there is a
    // phishing tool dressed as the operator's own preview.
    for (const value of ['https://evil.example', 'javascript:alert(1)', '//evil.example', '/\\evil.example', 'blog', '/a\r\nSet-Cookie: x=1']) {
      expect(SitePreviewLandingPath.normalize(value)).toBe('/');
    }
  });

  it('treats a missing or oversized value as the home page', () => {
    expect(SitePreviewLandingPath.normalize(undefined)).toBe('/');
    expect(SitePreviewLandingPath.normalize(`/${'a'.repeat(3000)}`)).toBe('/');
  });
});
