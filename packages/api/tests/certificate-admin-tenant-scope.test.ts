import { describe, expect, it, vi } from 'vitest';
import { CertificateAdminController } from '@api/controllers/system/certificate-admin-controller';
import { CertificateAdminService } from '@api/services/certificates/certificate-admin-service';

/**
 * `list()` answered the `?tenantId=` QUERY PARAM, and never asked WHERE the request itself stood.
 *
 * `PlatformAdminGuard` on this route answers WHO — every caller reaching `list()` is a platform
 * admin. It does not answer WHERE: an operator who has stepped INTO a site is still that role, and
 * the general `/certificates` admin page never sends a `tenantId` query param, so `overview()` — the
 * unscoped, whole-platform read — ran for every visit. A platform admin standing inside one
 * customer's site therefore saw every OTHER customer's certificates on that site's own screen.
 *
 * `req.tenantId` is what carries WHERE (the same marker `system-runtime-controller.ts`'s
 * `readsWholeContainer` reads for the identical shape of bug). When it is bound, `forTenant` is the
 * only answer — regardless of any `?tenantId=` query param naming a DIFFERENT site. Only an unbound
 * request, the platform-wide certificates screen, still lets the query param choose one site or falls
 * through to every host on the box.
 */
const respond = () => {
  const out: any = { status: 200 };
  const res: any = {
    json: (body: any) => { out.body = body; return res; },
    status: (code: number) => { out.status = code; return res; },
    end: () => res,
  };
  return { res, out };
};

const controllerWith = () => {
  const calls: { forTenant: string[]; overview: number } = { forTenant: [], overview: 0 };
  const service = {
    forTenant: vi.fn(async (tenantId: string) => { calls.forTenant.push(tenantId); return { hosts: [], scope: tenantId }; }),
    overview: vi.fn(async () => { calls.overview += 1; return { hosts: [], scope: 'platform' }; }),
  };
  return { controller: new CertificateAdminController(service as never), calls, service };
};

/**
 * `upload`/`setSource`/`remove` never checked `req.tenantId` against the host at all — the mirror of
 * the `list()` bug above, on the write side. A platform admin scoped INTO site A could name a host
 * belonging to site B and the write would go through, even though the UI never offers that host.
 *
 * `hostTenantId` is stubbed to answer who actually owns each host, exactly like the real service
 * resolves it from `servedHosts()` — the controller must ask THAT, never trust a client-supplied
 * tenant id.
 */
const HOSTS: Record<string, string | null> = {
  'initech.example': 'initech',
  'acme.example': 'acme',
  'platform.example': null,
};

const writeControllerWith = () => {
  const calls: { upload: any[]; setSource: any[]; remove: any[]; hostTenantId: string[] } = {
    upload: [], setSource: [], remove: [], hostTenantId: [],
  };
  const service = {
    hostTenantId: vi.fn(async (host: string) => {
      calls.hostTenantId.push(host);
      return Object.prototype.hasOwnProperty.call(HOSTS, host) ? HOSTS[host] : undefined;
    }),
    upload: vi.fn(async (host: string) => { calls.upload.push(host); return { toAdminJson: () => ({ host }) }; }),
    setSource: vi.fn(async (host: string) => { calls.setSource.push(host); return { toAdminJson: () => ({ host }) }; }),
    remove: vi.fn(async (host: string) => { calls.remove.push(host); return true; }),
  };
  return { controller: new CertificateAdminController(service as never), calls, service };
};

describe('certificate writes inside a site', () => {
  it('refuses to upload a certificate for a host belonging to a DIFFERENT site', async () => {
    const { controller, calls, service } = writeControllerWith();
    const { res, out } = respond();

    await controller.upload(
      { tenantId: 'initech', body: { host: 'acme.example', certificatePem: 'x', privateKeyPem: 'y' } } as any,
      res,
    );

    expect(out.status).toBe(404);
    expect(out.body).toEqual({ error: 'certificate_not_found' });
    expect(service.upload).not.toHaveBeenCalled();
    expect(calls.hostTenantId).toEqual(['acme.example']);
  });

  it('refuses to switch the source of a host belonging to a DIFFERENT site', async () => {
    const { controller, service } = writeControllerWith();
    const { res, out } = respond();

    await controller.setSource(
      { tenantId: 'initech', params: { host: 'acme.example' }, body: { source: 'automatic' } } as any,
      res,
    );

    expect(out.status).toBe(404);
    expect(out.body).toEqual({ error: 'certificate_not_found' });
    expect(service.setSource).not.toHaveBeenCalled();
  });

  it('refuses to remove the certificate of a host belonging to a DIFFERENT site', async () => {
    const { controller, service } = writeControllerWith();
    const { res, out } = respond();

    await controller.remove({ tenantId: 'initech', params: { host: 'acme.example' } } as any, res);

    expect(out.status).toBe(404);
    expect(out.body).toEqual({ error: 'certificate_not_found' });
    expect(service.remove).not.toHaveBeenCalled();
  });

  it('refuses a host that belongs to no tenant at all (one of the platform\'s own three)', async () => {
    const { controller, service } = writeControllerWith();
    const { res, out } = respond();

    await controller.remove({ tenantId: 'initech', params: { host: 'platform.example' } } as any, res);

    expect(out.status).toBe(404);
    expect(service.remove).not.toHaveBeenCalled();
  });

  it('refuses a host the platform does not serve at all, same as an unresolvable host', async () => {
    const { controller, service } = writeControllerWith();
    const { res, out } = respond();

    await controller.remove({ tenantId: 'initech', params: { host: 'nowhere.example' } } as any, res);

    expect(out.status).toBe(404);
    expect(service.remove).not.toHaveBeenCalled();
  });

  it('still allows upload/setSource/remove for a host that DOES belong to the bound site', async () => {
    const { controller, calls } = writeControllerWith();

    const uploadRes = respond();
    await controller.upload(
      { tenantId: 'initech', body: { host: 'initech.example', certificatePem: 'x', privateKeyPem: 'y' } } as any,
      uploadRes.res,
    );
    expect(uploadRes.out.status).toBe(201);
    expect(calls.upload).toEqual(['initech.example']);

    const sourceRes = respond();
    await controller.setSource(
      { tenantId: 'initech', params: { host: 'initech.example' }, body: { source: 'automatic' } } as any,
      sourceRes.res,
    );
    expect(sourceRes.out.status).toBe(200);
    expect(calls.setSource).toEqual(['initech.example']);

    const removeRes = respond();
    await controller.remove({ tenantId: 'initech', params: { host: 'initech.example' } } as any, removeRes.res);
    expect(removeRes.out.status).toBe(204);
    expect(calls.remove).toEqual(['initech.example']);
  });
});

describe('certificate writes in the platform scope', () => {
  it('allows upload/setSource/remove for ANY host when nothing is bound', async () => {
    const { controller, calls } = writeControllerWith();

    const uploadRes = respond();
    await controller.upload(
      { tenantId: undefined, body: { host: 'acme.example', certificatePem: 'x', privateKeyPem: 'y' } } as any,
      uploadRes.res,
    );
    expect(uploadRes.out.status).toBe(201);

    const removeRes = respond();
    await controller.remove({ tenantId: undefined, params: { host: 'platform.example' } } as any, removeRes.res);
    expect(removeRes.out.status).toBe(204);

    expect(calls.hostTenantId).toEqual([]);
  });
});

describe('certificate list inside a site', () => {
  it('scopes to the bound site and ignores overview entirely', async () => {
    const { controller, calls } = controllerWith();
    const { res, out } = respond();

    await controller.list({ tenantId: 'initech', query: {} } as any, res);

    expect(calls.overview).toBe(0);
    expect(calls.forTenant).toEqual(['initech']);
    expect(out.body).toEqual({ hosts: [], scope: 'initech' });
  });

  it('scopes to the bound site even when a DIFFERENT tenantId is passed as a query param', async () => {
    const { controller, calls } = controllerWith();
    const { res } = respond();

    await controller.list({ tenantId: 'initech', query: { tenantId: 'acme' } } as any, res);

    expect(calls.overview).toBe(0);
    expect(calls.forTenant).toEqual(['initech']);
  });
});

describe('certificate list in the platform scope', () => {
  it('still reads every host when nothing is bound and no tenantId is requested', async () => {
    const { controller, calls } = controllerWith();
    const { res, out } = respond();

    await controller.list({ tenantId: undefined, query: {} } as any, res);

    expect(calls.overview).toBe(1);
    expect(calls.forTenant).toEqual([]);
    expect(out.body).toEqual({ hosts: [], scope: 'platform' });
  });

  it('still honors an explicit tenantId query param when nothing is bound', async () => {
    const { controller, calls } = controllerWith();
    const { res } = respond();

    await controller.list({ tenantId: '', query: { tenantId: 'acme' } } as any, res);

    expect(calls.overview).toBe(0);
    expect(calls.forTenant).toEqual(['acme']);
  });
});
