import { SystemController } from '../src/controllers/system-controller';

describe('SystemController.getAdminMetadata secondaryPanel propagation', () => {
  const createController = (metadata: any) => {
    const manager: any = {
      hooks: { on: jest.fn() },
      getAdminMetadata: jest.fn().mockResolvedValue(metadata),
      getRuntimeModules: jest.fn().mockReturnValue({}),
      db: {
        find: jest.fn().mockResolvedValue([]),
      },
    };
    const themeManager: any = {
      getFrontendMetadata: jest.fn().mockResolvedValue({}),
    };
    const restController: any = {};
    const auth: any = {};
    return { controller: new SystemController(manager, themeManager, restController, auth), manager };
  };

  it('preserves secondaryPanel when present in manager metadata payload', async () => {
    const payload = {
      plugins: [],
      menu: [],
      secondaryPanel: {
        version: 1,
        contexts: { 'org.fromcode:finance': { id: 'org.fromcode:finance' } },
        itemsByContext: {},
        globalItems: [],
        policy: { allowlistKey: 'admin.secondaryPanel.allowlist.v1', allowlistEntries: 1, evaluatedAt: '2026-04-02T00:00:00.000Z' },
        precedence: { scopeOrder: ['self', 'plugin-target', 'global'], tieBreakOrder: ['priority-asc', 'canonicalId-asc'] },
      },
    };
    const { controller } = createController(payload);
    const req: any = {};
    const res: any = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await controller.getAdminMetadata(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      secondaryPanel: payload.secondaryPanel,
    }));
  });

  it('injects default secondaryPanel shape when field is absent', async () => {
    const { controller } = createController({ plugins: [], menu: [] });
    const req: any = {};
    const res: any = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await controller.getAdminMetadata(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      secondaryPanel: expect.objectContaining({
        version: 1,
        contexts: {},
        itemsByContext: {},
        globalItems: [],
        policy: expect.objectContaining({
          allowlistKey: 'admin.secondaryPanel.allowlist.v1',
        }),
        precedence: {
          scopeOrder: ['self', 'plugin-target', 'global'],
          tieBreakOrder: ['priority-asc', 'canonicalId-asc'],
        },
      }),
    }));
  });
});
