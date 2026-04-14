import { SystemController } from '../src/controllers/system-controller';

describe('SystemController.resolveSlug', () => {
  it('returns a canonical resolved doc shape from legacy fields', async () => {
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

    (controller as any).resolution = {
      resolveSlug: jest.fn().mockResolvedValue({
        type: 'pages',
        plugin: 'system',
        doc: {
          id: 1,
          slug: 'home',
          pageTemplate: 'LandingPage',
          contentBlocks: [{ type: 'hero' }],
        },
      }),
    };

    await controller.resolveSlug(req, res);

    expect(res.json).toHaveBeenCalledWith({
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
    });
  });
});