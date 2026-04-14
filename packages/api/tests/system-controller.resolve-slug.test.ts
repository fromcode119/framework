import { SystemController } from '../src/controllers/system/system-controller';

describe('SystemController.resolveSlug', () => {
  it('delegates slug resolution through the runtime controller', async () => {
    const manager: any = {
      hooks: { on: jest.fn() },
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
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
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
      resolveSlug: jest.fn().mockImplementation(async (_req: any, runtimeRes: any) => {
        runtimeRes.json(expected);
      }),
    };

    await controller.resolveSlug(req, res);

    expect((controller as any).runtimeController.resolveSlug).toHaveBeenCalledWith(req, res);
    expect(res.json).toHaveBeenCalledWith(expected);
  });
});