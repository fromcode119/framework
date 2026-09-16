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
  const out: any = {};
  return {
    res: { json: (body: any) => { out.body = body; return out; } } as any,
    out,
  };
};

const controllerWith = () => {
  const calls: { forTenant: string[]; overview: number } = { forTenant: [], overview: 0 };
  const service = {
    forTenant: vi.fn(async (tenantId: string) => { calls.forTenant.push(tenantId); return { hosts: [], scope: tenantId }; }),
    overview: vi.fn(async () => { calls.overview += 1; return { hosts: [], scope: 'platform' }; }),
  };
  return { controller: new CertificateAdminController(service as never), calls, service };
};

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
