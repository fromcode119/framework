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
});
