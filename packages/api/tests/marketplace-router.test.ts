import express from 'express';
import request from 'supertest';
import { MarketplaceRouter } from '@api/routes/marketplace';

describe('MarketplaceRouter install route', () => {
  const manifest = {
    slug: 'analytics',
    name: 'Site Analytics',
    version: '0.1.2',
  };

  const passthrough = (_req: any, _res: any, next: () => void) => next();
  const refuse = (_req: any, res: any) => res.status(403).json({ error: 'platform_admin_required' });

  const buildApp = (options: { platformAdminAllows?: boolean } = {}) => {
    const manager: any = {
      marketplace: {
        downloadAndInstall: vi.fn(),
      },
      installOrUpdateFromMarketplace: vi.fn().mockResolvedValue(manifest),
    };
    const auth: any = {
      middleware: vi.fn().mockReturnValue(passthrough),
      guard: vi.fn().mockReturnValue(passthrough),
    };
    // The PLATFORM guard is a separate collaborator from `auth`: `admin` is a tenant's own
    // administrator on a multi-tenant deployment, and installing code onto the shared container
    // needs more than that. Faked structurally, like `auth`, so these tests stay about the route.
    const platformAdmin: any = {
      middleware: vi.fn().mockReturnValue(options.platformAdminAllows === false ? refuse : passthrough),
    };

    const app = express();
    app.use(express.json());
    app.use('/api/v1/marketplace', new MarketplaceRouter(manager, auth, platformAdmin).router);
    return { app, manager };
  };

  it('REFUSES install when the caller is not a platform admin, and never reaches the manager', async () => {
    // Before this guard the route was gated on `admin` alone — so on a multi-tenant deployment a
    // customer's own administrator could put arbitrary code on the box every other customer runs on.
    const { app, manager } = buildApp({ platformAdminAllows: false });

    const response = await request(app)
      .post('/api/v1/marketplace/install/analytics')
      .send({});

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'platform_admin_required' });
    expect(manager.installOrUpdateFromMarketplace).not.toHaveBeenCalled();
    expect(manager.marketplace.downloadAndInstall).not.toHaveBeenCalled();
  });

  it('uses plugin manager installOrUpdateFromMarketplace so updates activate the new manifest', async () => {
    const { app, manager } = buildApp();

    const response = await request(app)
      .post('/api/v1/marketplace/install/analytics')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, manifest });
    // The route ALWAYS passes an options object — that is the only channel for the optional
    // `?version=` pin, and with no pin the value is `undefined`, which is what the manager's
    // defaulted `options` parameter means anyway. The old single-argument expectation was written
    // before `?version=` existed and had simply gone stale.
    expect(manager.installOrUpdateFromMarketplace).toHaveBeenCalledWith('analytics', { version: undefined });
    expect(manager.marketplace.downloadAndInstall).not.toHaveBeenCalled();
  });

  it('forwards an explicit ?version= pin to the plugin manager', async () => {
    const { app, manager } = buildApp();

    const response = await request(app)
      .post('/api/v1/marketplace/install/analytics?version=0.1.2')
      .send({});

    expect(response.status).toBe(200);
    expect(manager.installOrUpdateFromMarketplace).toHaveBeenCalledWith('analytics', { version: '0.1.2' });
  });

  it('treats a blank ?version= as no pin rather than an empty-string version', async () => {
    const { app, manager } = buildApp();

    await request(app)
      .post('/api/v1/marketplace/install/analytics?version=%20%20')
      .send({});

    expect(manager.installOrUpdateFromMarketplace).toHaveBeenCalledWith('analytics', { version: undefined });
  });
});
