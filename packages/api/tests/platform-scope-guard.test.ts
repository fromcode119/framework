import express from 'express';
import request from 'supertest';
import { TenantMode } from '@fromcode119/core';
import { PlatformScopeGuard } from '@api/middlewares/platform-scope-guard';

/**
 * The platform's INVENTORY is read with no site selected — by everyone.
 *
 * This guard is the scope half of a rule whose other half is PlatformAdminGuard, and the pair is
 * easy to collapse into one idea. These tests keep them apart: every case here is a caller who has
 * ALREADY passed the platform-admin check, so a pass or a refusal here is about WHERE the request
 * is standing and nothing else.
 */

const app = (bind?: string) => {
  const server = express();
  if (bind) server.use((req: any, _res, next) => { req.tenantId = bind; next(); });
  server.get('/catalogue', new PlatformScopeGuard().middleware(), (_req, res) => { res.json({ items: ['alpha', 'beta'] }); });
  return server;
};

afterEach(() => TenantMode.reset());

describe('PlatformScopeGuard', () => {
  it('refuses a request standing inside a site, however privileged the caller', async () => {
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });

    const response = await request(app('site-a')).get('/catalogue');

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('platform_scope_required');
    // The refusal has to say where the thing IS, or hiding it makes it undiscoverable.
    expect(response.body.message).toMatch(/no site selected|leave the site/i);
  });

  it('answers in PLATFORM scope, which is where the catalogue belongs', async () => {
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });

    const response = await request(app()).get('/catalogue');

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual(['alpha', 'beta']);
  });

  it('never refuses on a SINGLE-TENANT deployment — there is no second scope to be in', async () => {
    const response = await request(app('site-a')).get('/catalogue');

    expect(response.status).toBe(200);
  });

  it('treats a blank tenant id as no site, rather than as a site named ""', async () => {
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });

    const response = await request(app('   ')).get('/catalogue');

    expect(response.status).toBe(200);
  });
});
