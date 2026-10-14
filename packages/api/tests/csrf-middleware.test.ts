import { describe, expect, it, vi } from 'vitest';
import { CSRFMiddleware } from '@api/middlewares/csrf-middleware';

describe('CSRFMiddleware', () => {
  it('does not let a client-identification header bypass cookie CSRF checks', async () => {
    const req: any = {
      method: 'POST', path: '/v1/plugins/example/settings', headers: { 'x-framework-client': 'admin-ui' },
      cookies: {}, get(name: string) { return this.headers[name.toLowerCase()]; },
    };
    const res: any = {
      cookie: vi.fn(), status: vi.fn(), json: vi.fn(),
    };
    res.status.mockReturnValue(res);
    const next = vi.fn();

    await new CSRFMiddleware().handle(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('keeps authorization-header clients exempt from cookie CSRF checks', async () => {
    const req: any = {
      method: 'POST', path: '/v1/plugins/example/settings', headers: { authorization: 'Bearer token' },
      cookies: {}, get: vi.fn(),
    };
    const res: any = { cookie: vi.fn() };
    const next = vi.fn();

    await new CSRFMiddleware().handle(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  /** The updater service reports to `/internal/updater/status` with the deployment secret, never a cookie. */
  describe('a service of this deployment on an /internal route', () => {
    const post = (headers: Record<string, string>) => ({
      method: 'POST', path: '/v1/internal/updater/status', headers, cookies: {},
      get(name: string) { return (this as any).headers[name.toLowerCase()]; },
    });
    const run = async (req: any) => {
      const res: any = { cookie: vi.fn(), status: vi.fn(), json: vi.fn() };
      res.status.mockReturnValue(res);
      const next = vi.fn();
      await new CSRFMiddleware().handle(req, res, next);
      return { res, next };
    };

    it('is let through with the right secret', async () => {
      vi.stubEnv('INTERNAL_SERVICE_SECRET', 's'.repeat(64));
      const { next } = await run(post({ 'x-fromcode-internal-secret': 's'.repeat(64) }));
      expect(next).toHaveBeenCalledOnce();
      vi.unstubAllEnvs();
    });

    it('still needs the CSRF token with a wrong secret', async () => {
      vi.stubEnv('INTERNAL_SERVICE_SECRET', 's'.repeat(64));
      const { res, next } = await run(post({ 'x-fromcode-internal-secret': 'x'.repeat(64) }));
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
      vi.unstubAllEnvs();
    });
  });
});
