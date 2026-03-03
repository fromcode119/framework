import { ForgeController } from '../src/api/controller';

type MockReq = any;
type MockRes = any;

function createResponseMock(): MockRes {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    setHeader: jest.fn(),
  };
}

function createControllerHarness() {
  const db = {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    insert: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(true),
  };

  const manager: any = {
    db,
    auth: {},
    hooks: {
      call: jest.fn().mockResolvedValue({}),
    },
    emit: jest.fn(),
    integrations: {
      get: jest.fn().mockResolvedValue({ chat: jest.fn() }),
      getConfig: jest.fn().mockResolvedValue({ active: { provider: 'ollama', config: {} }, storedProviders: [] }),
      instantiateWithConfig: jest.fn().mockResolvedValue({ instance: { chat: jest.fn() } }),
    },
    getCollections: jest.fn().mockReturnValue([]),
    getPlugins: jest.fn().mockReturnValue([]),
    getRuntimeModules: jest.fn().mockReturnValue([]),
    getAdminMetadata: jest.fn().mockReturnValue({}),
  };

  const themeManager: any = {
    getThemes: jest.fn().mockReturnValue([]),
    getFrontendMetadata: jest.fn().mockResolvedValue({}),
  };

  const restController: any = {};
  const controller = new ForgeController(manager, themeManager, restController);

  return { controller, manager, db };
}

describe('assistant-controller modernization', () => {
  it('uses canonical chat contract and returns structured artifacts', async () => {
    const { controller, manager } = createControllerHarness();
    const runtime = {
      chat: jest.fn().mockResolvedValue({
        message: 'Plan ready.',
        actions: [],
        model: 'llama3.1:8b',
        agentMode: 'advanced',
        done: true,
        traces: [],
        plan: {
          id: 'plan-1',
          status: 'completed',
          goal: 'hello',
          summary: 'done',
          steps: [],
          actions: [],
          risk: 'low',
          previewReady: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ui: {
          canContinue: false,
          requiresApproval: false,
          suggestedMode: 'chat',
          showTechnicalDetailsDefault: false,
        },
        skill: { id: 'general', label: 'General', defaultMode: 'chat', riskPolicy: 'approval_required' },
        sessionId: 'session-1',
        iterations: 1,
        loopCapReached: false,
      }),
    };

    jest.spyOn(controller as any, 'createAssistantRuntime').mockReturnValue(runtime as any);
    jest.spyOn(controller as any, 'resolveAssistantClientFromRequest').mockResolvedValue({
      client: { chat: jest.fn() },
      provider: 'ollama',
    });

    const req: MockReq = {
      body: {
        message: 'hello',
        history: [],
        sessionId: 'session-1',
        agentMode: 'advanced',
        tools: ['system.now'],
        skillId: 'general',
      },
      headers: {},
      cookies: {},
      user: { id: 1 },
    };
    const res = createResponseMock();

    await controller.assistantChat(req as any, res as any);

    expect(runtime.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'hello',
        sessionId: 'session-1',
        skillId: 'general',
        allowedTools: ['system.now'],
      }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'ollama',
        sessionId: 'session-1',
        plan: expect.any(Object),
        ui: expect.any(Object),
      }),
    );
    expect(manager.hooks.call).toHaveBeenCalledWith(
      'assistant:telemetry',
      expect.objectContaining({ event: 'chat.success' }),
    );
  });

  it('accepts legacy chat payload and emits deprecation headers', async () => {
    const { controller } = createControllerHarness();
    const runtime = {
      chat: jest.fn().mockResolvedValue({
        message: 'Legacy ok.',
        actions: [],
        model: 'llama3.1:8b',
        agentMode: 'advanced',
        done: true,
        traces: [],
      }),
    };

    jest.spyOn(controller as any, 'createAssistantRuntime').mockReturnValue(runtime as any);
    jest.spyOn(controller as any, 'resolveAssistantClientFromRequest').mockResolvedValue({
      client: { chat: jest.fn() },
      provider: 'ollama',
    });

    const req: MockReq = {
      body: {
        messages: [{ role: 'user', content: 'replace text' }],
        mode: 'plan',
        persona: 'editor',
        allowedTools: ['content.search_text'],
      },
      headers: {},
      cookies: {},
      user: { id: 1 },
    };
    const res = createResponseMock();

    await controller.assistantChat(req as any, res as any);

    expect(runtime.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'replace text',
        agentMode: 'advanced',
        skillId: 'editor',
        allowedTools: ['content.search_text'],
      }),
    );
    expect(res.setHeader).toHaveBeenCalledWith('Deprecation', 'true');
    expect(res.setHeader).toHaveBeenCalledWith('X-Fromcode-Deprecated', 'true');
  });

  it('maps legacy execute payload to canonical execute contract', async () => {
    const { controller } = createControllerHarness();
    const runtime = {
      executeActions: jest.fn().mockResolvedValue({
        success: true,
        dryRun: true,
        results: [{ ok: true, dryRun: true }],
      }),
    };
    jest.spyOn(controller as any, 'createAssistantRuntime').mockReturnValue(runtime as any);

    const req: MockReq = {
      body: {
        stagedActions: [{ type: 'update_setting', key: 'site.title', value: 'New title' }],
        preview: true,
      },
      headers: {},
      cookies: {},
      user: { id: 1 },
    };
    const res = createResponseMock();

    await controller.executeAssistantLegacy(req as any, res as any);

    expect(runtime.executeActions).toHaveBeenCalledWith(
      expect.objectContaining({
        dryRun: true,
        actions: [{ type: 'update_setting', key: 'site.title', value: 'New title' }],
      }),
    );
    expect(res.setHeader).toHaveBeenCalledWith('Deprecation', 'true');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
      }),
    );
  });

  it('continues a saved assistant session and keeps session id stable', async () => {
    const { controller, db, manager } = createControllerHarness();
    const sessionPayload = {
      id: 'session-continue',
      provider: 'ollama',
      model: 'llama3.1:8b',
      agentMode: 'advanced',
      skillId: 'general',
      tools: ['content.search_text'],
      config: { baseUrl: 'http://127.0.0.1:11434' },
      history: [{ role: 'user', content: 'find text' }],
      lastCheckpoint: { resumePrompt: 'Continue planning', reason: 'loop_cap' },
    };

    db.findOne.mockImplementation(async (_table: string, where: any) => {
      if (where?.key === 'assistant.session.session-continue') {
        return { key: where.key, value: JSON.stringify(sessionPayload), group: 'assistant-session' };
      }
      return null;
    });

    const runtime = {
      chat: jest.fn().mockResolvedValue({
        message: 'Continued.',
        actions: [],
        model: 'llama3.1:8b',
        agentMode: 'advanced',
        done: false,
        traces: [{ iteration: 1, phase: 'planner', message: 'Continuing', toolCalls: [] }],
        plan: {
          id: 'plan-continue',
          status: 'paused',
          goal: 'Continue planning',
          summary: 'Paused again',
          steps: [],
          actions: [],
          risk: 'low',
          previewReady: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ui: {
          canContinue: true,
          requiresApproval: false,
          suggestedMode: 'agent',
          showTechnicalDetailsDefault: false,
        },
        skill: { id: 'general', label: 'General', defaultMode: 'chat', riskPolicy: 'approval_required' },
        sessionId: 'session-continue',
        checkpoint: { resumePrompt: 'Continue planning', reason: 'loop_cap' },
        iterations: 2,
        loopCapReached: true,
      }),
    };

    jest.spyOn(controller as any, 'createAssistantRuntime').mockReturnValue(runtime as any);
    jest.spyOn(controller as any, 'resolveAssistantClientFromRequest').mockResolvedValue({
      client: { chat: jest.fn() },
      provider: 'ollama',
    });

    const req: MockReq = {
      params: { id: 'session-continue' },
      body: {},
      headers: {},
      cookies: {},
      user: { id: 1 },
    };
    const res = createResponseMock();

    await controller.continueAssistantSession(req as any, res as any);

    expect(runtime.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        continueFrom: true,
        sessionId: 'session-continue',
      }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'ollama',
        sessionId: 'session-continue',
      }),
    );
    expect(manager.hooks.call).toHaveBeenCalledWith(
      'assistant:telemetry',
      expect.objectContaining({ event: 'chat.continue' }),
    );
  });

  it('exposes built-in browsing skills in assistant skills endpoint', async () => {
    const { controller } = createControllerHarness();
    const req: MockReq = { body: {}, headers: {}, cookies: {} };
    const res = createResponseMock();

    await controller.assistantSkills(req as any, res as any);

    const payload = (res.json as jest.Mock).mock.calls[0][0];
    const skillIds = Array.isArray(payload?.skills) ? payload.skills.map((entry: any) => entry.id) : [];
    expect(skillIds).toEqual(expect.arrayContaining(['general', 'research', 'page-audit']));

    const researchSkill = payload.skills.find((entry: any) => entry.id === 'research');
    expect(Array.isArray(researchSkill?.allowedTools) ? researchSkill.allowedTools : []).toEqual(
      expect.arrayContaining(['web.search', 'web.fetch']),
    );
  });

  it('exposes web fetch tool in assistant tools endpoint', async () => {
    const { controller } = createControllerHarness();
    const req: MockReq = { body: {}, headers: {}, cookies: {} };
    const res = createResponseMock();

    await controller.assistantTools(req as any, res as any);

    const payload = (res.json as jest.Mock).mock.calls[0][0];
    const toolNames = Array.isArray(payload?.tools) ? payload.tools.map((entry: any) => entry.tool) : [];
    expect(toolNames).toEqual(expect.arrayContaining(['web.search', 'web.fetch']));
  });

  it('lists, fetches, forks, and deletes persisted assistant sessions', async () => {
    const { controller, db } = createControllerHarness();
    const stored = {
      id: 'session-alpha',
      title: 'Replace hero text',
      updatedAt: Date.now(),
      provider: 'ollama',
      model: 'llama3.1:8b',
      skillId: 'general',
      history: [
        { role: 'user', content: 'replace text' },
        { role: 'assistant', content: 'Plan ready' },
      ],
      lastActions: [{ type: 'mcp_call', tool: 'content.update', input: { id: 1 } }],
    };

    db.find.mockResolvedValue([
      {
        key: 'assistant.session.session-alpha',
        group: 'assistant-session',
        value: JSON.stringify(stored),
      },
    ]);
    db.findOne.mockResolvedValue({
      key: 'assistant.session.session-alpha',
      group: 'assistant-session',
      value: JSON.stringify(stored),
    });

    const listReq: MockReq = { query: {}, body: {}, headers: {}, cookies: {} };
    const listRes = createResponseMock();
    await controller.assistantSessions(listReq as any, listRes as any);
    expect(listRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        sessions: [
          expect.objectContaining({
            id: 'session-alpha',
            title: 'Replace hero text',
            provider: 'ollama',
          }),
        ],
      }),
    );

    const detailReq: MockReq = { params: { id: 'session-alpha' }, body: {}, headers: {}, cookies: {} };
    const detailRes = createResponseMock();
    await controller.assistantSession(detailReq as any, detailRes as any);
    expect(detailRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        session: expect.objectContaining({
          id: 'session-alpha',
          messages: expect.any(Array),
        }),
      }),
    );

    const forkReq: MockReq = { params: { id: 'session-alpha' }, body: { fromMessageIndex: 0 }, headers: {}, cookies: {} };
    const forkRes = createResponseMock();
    await controller.forkAssistantSession(forkReq as any, forkRes as any);
    expect(forkRes.status).toHaveBeenCalledWith(201);
    expect(forkRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        session: expect.objectContaining({
          id: expect.stringMatching(/^session-/),
        }),
      }),
    );
    expect(db.insert.mock.calls.length + db.update.mock.calls.length).toBeGreaterThan(0);

    const deleteReq: MockReq = { params: { id: 'session-alpha' }, body: {}, headers: {}, cookies: {} };
    const deleteRes = createResponseMock();
    await controller.deleteAssistantSession(deleteReq as any, deleteRes as any);
    expect(db.delete).toHaveBeenCalledWith(expect.anything(), { key: 'assistant.session.session-alpha' });
    expect(deleteRes.json).toHaveBeenCalledWith({ success: true });
  });
});
