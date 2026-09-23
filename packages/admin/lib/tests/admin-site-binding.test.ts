import { describe, expect, it } from 'vitest';

const { AdminSiteBinding } = await import('@/lib/admin-site-binding');

describe('AdminSiteBinding — each tab names the site its page opened on', () => {
  it('sends nothing until the page knows its site, then names it on writes only', () => {
    expect(AdminSiteBinding.headers('PUT')).toEqual({});
    AdminSiteBinding.record('example-site');
    expect(AdminSiteBinding.headers('PUT')).toEqual({ 'X-Framework-Site': 'example-site' });
    expect(AdminSiteBinding.headers('GET')).toEqual({});
  });

  it('keeps the FIRST answer — a later read after another tab switched must not hide the mismatch', () => {
    AdminSiteBinding.record('acme');
    expect(AdminSiteBinding.headers('POST')).toEqual({ 'X-Framework-Site': 'example-site' });
  });
});
