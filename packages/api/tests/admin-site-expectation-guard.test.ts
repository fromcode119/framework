import { describe, expect, it } from 'vitest';
import { AdminSiteHeaderConstants, ApiPathUtils, SystemConstants } from '@fromcode119/core';
import { AdminSiteExpectationGuard } from '@api/server/admin-site-expectation-guard';

const request = (method: string, site: string | undefined, path = '/api/v1/system/admin/settings') => ({
  method,
  path,
  headers: site === undefined ? {} : { [AdminSiteHeaderConstants.NAME.toLowerCase()]: site },
});

describe('AdminSiteExpectationGuard — a page saves only into the site it was opened for', () => {
  it('refuses a write from a page opened for another site (the session was switched in another tab)', () => {
    const refusal = AdminSiteExpectationGuard.refusal(request('PUT', '@platform'), 'vselenskiportal');
    expect(refusal).toMatchObject({ error: 'site_changed', expected: '@platform', current: 'vselenskiportal' });
    expect(AdminSiteExpectationGuard.refusal(request('PUT', 'acme'), null)).toMatchObject({ current: '@platform' });
  });

  it('lets the write through when the page and the session agree', () => {
    expect(AdminSiteExpectationGuard.refusal(request('PUT', 'vselenskiportal'), 'vselenskiportal')).toBeNull();
    expect(AdminSiteExpectationGuard.refusal(request('POST', '@platform'), null)).toBeNull();
  });

  it('never refuses a read, a request that names no site, or the site switch itself', () => {
    expect(AdminSiteExpectationGuard.refusal(request('GET', 'acme'), 'vselenskiportal')).toBeNull();
    expect(AdminSiteExpectationGuard.refusal(request('PUT', undefined), 'vselenskiportal')).toBeNull();
    const select = ApiPathUtils.versioned(SystemConstants.API_PATH.AUTH.TENANTS_SELECT);
    expect(AdminSiteExpectationGuard.refusal(request('POST', 'acme', select), 'vselenskiportal')).toBeNull();
  });
});
