import express from 'express';
import request from 'supertest';
import { setupSystemRoutes } from '../src/routes/system';
import { setupForgeRoutes } from '../src/routes/forge';
import { ForgeController } from '../src/controllers/forge-controller';

function createHarness() {
  const auth: any = {
    requirePermission: () => (_req: any, _res: any, next: any) => next(),
    guard: () => (_req: any, _res: any, next: any) => next(),
  };

  const manager: any = {
    db: {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      insert: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    },
    auth: {},
    hooks: {
      call: jest.fn().mockResolvedValue({}),
    },
    integrations: {
      get: jest.fn().mockResolvedValue(null),
      getConfig: jest.fn().mockResolvedValue({}),
      instantiateWithConfig: jest.fn().mockResolvedValue(null),
      listConfigs: jest.fn().mockResolvedValue([]),
    },
    emit: jest.fn(),
    getCollections: jest.fn().mockReturnValue([]),
    getPlugins: jest.fn().mockReturnValue([]),
    getSortedPlugins: jest.fn().mockImplementation((plugins: any[]) => plugins),
    getRuntimeModules: jest.fn().mockReturnValue([]),
    getAdminMetadata: jest.fn().mockReturnValue({}),
  };

  const themeManager: any = {
    getThemes: jest.fn().mockReturnValue([]),
    getFrontendMetadata: jest.fn().mockResolvedValue({}),
  };

  const restController: any = {};
  const app = express();
  app.use(express.json());
  app.use('/system', setupSystemRoutes(manager, themeManager, auth, restController));
  app.use('/forge', setupForgeRoutes(manager, themeManager, auth, restController));

  return { app };
}

describe('assistant route wiring', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('serves canonical forge chat endpoint through ForgeController', async () => {
    const chatSpy = jest
      .spyOn(ForgeController.prototype, 'assistantChat')
      .mockImplementation(async (_req: any, res: any) => res.json({ ok: true }));
    const { app } = createHarness();

    const canonical = await request(app)
      .post('/forge/admin/assistant/chat')
      .send({ message: 'hello' });

    expect(canonical.status).toBe(200);
    expect(chatSpy).toHaveBeenCalledTimes(1);
  });

  it('serves canonical execute endpoint through ForgeController', async () => {
    const executeSpy = jest
      .spyOn(ForgeController.prototype, 'executeAssistantActions')
      .mockImplementation(async (_req: any, res: any) => res.json({ success: true, results: [] }));
    const { app } = createHarness();

    const canonical = await request(app)
      .post('/forge/admin/assistant/actions/execute')
      .send({ actions: [{ type: 'update_setting', key: 'site.title', value: 'x' }] });

    expect(canonical.status).toBe(200);
    expect(executeSpy).toHaveBeenCalledTimes(1);
  });

  it('serves canonical session history endpoints through ForgeController', async () => {
    const listSpy = jest
      .spyOn(ForgeController.prototype, 'assistantSessions')
      .mockImplementation(async (_req: any, res: any) => res.json({ sessions: [] }));
    const detailSpy = jest
      .spyOn(ForgeController.prototype, 'assistantSession')
      .mockImplementation(async (_req: any, res: any) => res.json({ session: { id: 's1' } }));
    const forkSpy = jest
      .spyOn(ForgeController.prototype, 'forkAssistantSession')
      .mockImplementation(async (_req: any, res: any) => res.status(201).json({ session: { id: 's2' } }));
    const deleteSpy = jest
      .spyOn(ForgeController.prototype, 'deleteAssistantSession')
      .mockImplementation(async (_req: any, res: any) => res.json({ success: true }));
    const { app } = createHarness();

    const list = await request(app).get('/forge/admin/assistant/sessions');
    const detail = await request(app).get('/forge/admin/assistant/sessions/s1');
    const fork = await request(app).post('/forge/admin/assistant/sessions/s1/fork').send({});
    const remove = await request(app).delete('/forge/admin/assistant/sessions/s1');

    expect(list.status).toBe(200);
    expect(detail.status).toBe(200);
    expect(fork.status).toBe(201);
    expect(remove.status).toBe(200);
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(detailSpy).toHaveBeenCalledTimes(1);
    expect(forkSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });

  it('does not expose assistant aliases under system routes', async () => {
    const { app } = createHarness();

    const chatLegacy = await request(app)
      .post('/system/admin/assistant/chat')
      .send({ message: 'hello' });
    const executeLegacy = await request(app)
      .post('/system/admin/assistant/actions/execute')
      .send({ actions: [{ type: 'update_setting', key: 'site.title', value: 'x' }] });

    expect(chatLegacy.status).toBe(404);
    expect(executeLegacy.status).toBe(404);
  });
});
