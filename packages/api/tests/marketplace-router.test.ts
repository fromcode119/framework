import express from 'express';
import request from 'supertest';
import { MarketplaceRouter } from '../src/routes/marketplace';

describe('MarketplaceRouter install route', () => {
  it('uses plugin manager installOrUpdateFromMarketplace so updates activate the new manifest', async () => {
    const manifest = {
      slug: 'analytics',
      name: 'Site Analytics',
      version: '0.1.2',
    };

    const manager: any = {
      marketplace: {
        downloadAndInstall: jest.fn(),
      },
      installOrUpdateFromMarketplace: jest.fn().mockResolvedValue(manifest),
    };
    const auth: any = {
      middleware: jest.fn().mockReturnValue((_req: any, _res: any, next: () => void) => next()),
      guard: jest.fn().mockReturnValue((_req: any, _res: any, next: () => void) => next()),
    };

    const app = express();
    app.use(express.json());
    app.use('/api/v1/marketplace', new MarketplaceRouter(manager, auth).router);

    const response = await request(app)
      .post('/api/v1/marketplace/install/analytics')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, manifest });
    expect(manager.installOrUpdateFromMarketplace).toHaveBeenCalledWith('analytics');
    expect(manager.marketplace.downloadAndInstall).not.toHaveBeenCalled();
  });
});
