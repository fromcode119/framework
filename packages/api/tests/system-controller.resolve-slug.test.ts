import { SystemController } from '@api/controllers/system/system-controller';

describe('SystemController.resolveSlug', () => {
  it('delegates slug resolution through the runtime controller', async () => {
    const manager: any = {
      hooks: { on: vi.fn() },
      email: {},
      db: {},
    };
    const themeManager: any = {};
    const restController: any = {};
    const auth: any = {};
    const controller = new SystemController(manager, themeManager, restController, auth);
    const req: any = {
      query: { slug: '/home' },
      user: { roles: [] },
    };
    const res: any = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };

    const expected = {
      type: 'pages',
      plugin: 'system',
      doc: {
        id: 1,
        slug: 'home',
        pageTemplate: 'LandingPage',
        contentBlocks: [{ type: 'hero' }],
        themeLayout: 'LandingPage',
        content: [{ type: 'hero' }],
      },
    };

    (controller as any).runtimeController = {
      resolveSlug: vi.fn().mockImplementation(async (_req: any, runtimeRes: any) => {
        runtimeRes.json(expected);
      }),
    };

    await controller.resolveSlug(req, res);

    expect((controller as any).runtimeController.resolveSlug).toHaveBeenCalledWith(req, res);
    expect(res.json).toHaveBeenCalledWith(expected);
  });
});