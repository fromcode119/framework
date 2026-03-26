import { McpBridgeFactory } from '@fromcode119/mcp';
import { IntentClassifier } from '../src/admin-assistant-runtime/runtime/intent-classifier';
import { OrchestratorRunner } from '../src/admin-assistant-runtime/runtime/orchestrator';
import type { AdminAssistantRuntimeOptions, AssistantChatInput, AssistantSkillDefinition } from '../src/admin-assistant-runtime/types';
import { ProviderCapabilitiesUtils } from '../src/gateways/integration-provider';

function createOptions(overrides?: Partial<AdminAssistantRuntimeOptions>): AdminAssistantRuntimeOptions {
  return {
    aiClient: null,
    getCollections: () => [],
    findCollectionBySlug: () => null,
    createContent: async () => ({}),
    getSetting: async () => ({ found: false, value: null, group: null }),
    upsertSetting: async () => undefined,
    ...(overrides || {}),
  };
}

function createDeps(options?: Partial<AdminAssistantRuntimeOptions>) {
  const runtimeOptions = createOptions(options);
  const generalSkill: AssistantSkillDefinition = {
    id: 'general',
    label: 'General',
    defaultMode: 'chat',
    riskPolicy: 'approval_required',
  };

  return {
    options: runtimeOptions,
    resolveSkills: async () => [generalSkill],
    createBridge: async () => McpBridgeFactory.create({ tools: [] }),
    listTools: async () => [],
    sanitizeMessage: (message: string) => message,
    toRunMode: () => 'chat' as const,
    buildPlanArtifact: (input: any) => ({
      id: input.planId,
      status: 'completed',
      goal: input.goal,
      summary: input.message,
      steps: [],
      actions: input.actions || [],
      risk: 'low',
      previewReady: Array.isArray(input.actions) && input.actions.length > 0,
      createdAt: 'now',
      updatedAt: 'now',
    }),
    buildUiHints: () => ({
      canContinue: false,
      requiresApproval: false,
      suggestedMode: 'chat',
      showTechnicalDetailsDefault: false,
    }),
    resolveAgentMode: () => 'basic' as const,
    resolveSkillForInput: () => generalSkill,
    resolveProviderCapabilities: ProviderCapabilitiesUtils.resolveProviderCapabilities,
  };
}

describe('runtime classifier and fallback behavior', () => {
  it('classifies greetings as smalltalk', () => {
    const intent = IntentClassifier.classifyIntent({
      message: 'hey',
      history: [],
    });

    expect(intent.kind).toBe('smalltalk');
  });

  it('classifies simple arithmetic as factual_qa with quick answer', () => {
    const intent = IntentClassifier.classifyIntent({
      message: 'what is 5+5',
      history: [],
    });

    expect(intent.kind).toBe('factual_qa');
    expect(intent.quickAnswer).toBe('10');
  });

  it('parses typo variant "chanege ... to ..." as replace_text intent', () => {
    const intent = IntentClassifier.classifyIntent({
      message: 'chanege "07000 000001" to "07000 000002"',
      history: [],
    });

    expect(intent.kind).toBe('replace_text');
    expect(intent.replace?.from).toBe('07000 000001');
    expect(intent.replace?.to).toBe('07000 000002');
  });

  it('continues replace intent from clarification context on short follow-up', () => {
    const intent = IntentClassifier.classifyIntent({
      message: "it's a phone",
      history: [
        { role: 'user', content: 'change "07000 000001" to "07000 000002"' },
        { role: 'assistant', content: 'Need one detail to finish staging.' },
      ],
      checkpoint: { reason: 'clarification_needed', stage: 'clarify' },
    });

    expect(intent.kind).toBe('replace_text');
    expect(intent.replace?.from).toBe('07000 000001');
    expect(intent.replace?.to).toBe('07000 000002');
  });

  it('continues replace intent when user CliUtils.asks for match details from prior replace', () => {
    const intent = IntentClassifier.classifyIntent({
      message: 'what are the matches',
      history: [
        { role: 'user', content: 'want to change "£50k+" to "£60k+"' },
        { role: 'assistant', content: 'Found 12 matches and staged 4 changes.' },
      ],
    });

    expect(intent.kind).toBe('replace_text');
    expect(intent.replace?.from).toBe('£50k+');
    expect(intent.replace?.to).toBe('£60k+');
  });

  it('continues replace intent on "where are they" follow-up from prior replace', () => {
    const intent = IntentClassifier.classifyIntent({
      message: 'where are they?',
      history: [
        { role: 'user', content: 'want to change "£50k+" to "£60k+"' },
        { role: 'assistant', content: 'I found 4 file matches.' },
      ],
    });

    expect(intent.kind).toBe('replace_text');
    expect(intent.replace?.from).toBe('£50k+');
    expect(intent.replace?.to).toBe('£60k+');
  });

  it('answers clarification follow-up for CMS/content scope without generic fallback', () => {
    const intent = IntentClassifier.classifyIntent({
      message: 'what do you mean by cms content ?',
      history: [
        { role: 'user', content: 'want to change "£50k+" to "£60k+"' },
        {
          role: 'assistant',
          content:
            'I found 4 file matches for "£50k+" -> "£60k+". Do you want to update CMS/content values instead, or should I apply these file changes?',
        },
      ],
      checkpoint: { reason: 'clarification_needed', stage: 'clarify' },
    });

    expect(intent.kind).toBe('factual_qa');
    expect(String(intent.quickAnswer || '').toLowerCase()).toContain('content records');
    expect(String(intent.quickAnswer || '').toLowerCase()).toContain('reply with "cms" or "files"');
  });

  it('answers simple factual prompt directly without forcing staging language', async () => {
    const input: AssistantChatInput = {
      message: 'what is 5+5',
      agentMode: 'basic',
    };

    const result = await OrchestratorRunner.runOrchestrator(input, createDeps());

    expect(result).toBeTruthy();
    expect(String(result?.message || '').trim()).toBe('10');
    expect(result?.ui?.workflowState).toBe('reply');
  });

  it('returns contextual clarification answer instead of generic factual fallback', async () => {
    const result = await OrchestratorRunner.runOrchestrator(
      {
        message: 'what do you mean by cms content ?',
        history: [
          { role: 'user', content: 'want to change "£50k+" to "£60k+"' },
          {
            role: 'assistant',
            content:
              'I found 4 file matches for "£50k+" -> "£60k+". Do you want to update CMS/content values instead, or should I apply these file changes?',
          },
        ],
        checkpoint: { reason: 'clarification_needed', stage: 'clarify', resumePrompt: 'Choose target scope.' },
        agentMode: 'basic',
      },
      createDeps(),
    );

    expect(result).toBeTruthy();
    expect((result?.message || '').toLowerCase()).toContain('content records');
    expect((result?.message || '').toLowerCase()).toContain('reply with "cms" or "files"');
    expect((result?.message || '').toLowerCase()).not.toContain('share a bit more detail');
  });

  it('returns a natural chat fallback instead of staged-action boilerplate', async () => {
    const input: AssistantChatInput = {
      message: 'blorp',
      agentMode: 'basic',
    };

    const result = await OrchestratorRunner.runOrchestrator(input, createDeps());

    expect(result).toBeTruthy();
    expect((result?.message || '').toLowerCase()).not.toContain('stage exact changes');
    expect((result?.message || '').toLowerCase()).not.toContain('say the change naturally');
    expect(result?.ui?.canContinue).toBe(false);
    expect((result?.message || '').trim().length).toBeGreaterThan(0);
  });

  it('answers entity follow-up from workspace map (collection token)', async () => {
    const deps = createDeps({
      getCollections: () => [
        {
          slug: 'users',
          shortSlug: 'users',
          label: 'Users',
          pluginSlug: 'system',
          raw: { fields: [{ name: 'id' }, { name: 'email' }] },
        },
      ],
    });
    const result = await OrchestratorRunner.runOrchestrator(
      {
        message: 'users',
        agentMode: 'basic',
      },
      deps,
    );

    expect((result?.message || '').toLowerCase()).toContain('`users` is editable');
    expect((result?.message || '').toLowerCase()).toContain('list first 10 from users');
  });

  it('answers natural collection follow-up phrasing from workspace context', async () => {
    const deps = createDeps({
      getCollections: () => [
        {
          slug: 'users',
          shortSlug: 'users',
          label: 'Users',
          pluginSlug: 'system',
          raw: { fields: [{ name: 'id' }, { name: 'email' }] },
        },
      ],
    });
    const result = await OrchestratorRunner.runOrchestrator(
      {
        message: 'what users we have',
        history: [
          { role: 'user', content: 'List installed plugins, active theme, and editable collections.' },
          { role: 'assistant', content: 'Here is your current workspace inventory.' },
        ],
        checkpoint: { reason: 'user_continue', stage: 'finalize', resumePrompt: 'Continue from workspace inventory context.' },
        agentMode: 'basic',
      },
      deps,
    );

    expect((result?.message || '').toLowerCase()).toContain('`users` is editable');
    expect((result?.message || '').toLowerCase()).toContain('list current records');
    expect((result?.message || '').toLowerCase()).not.toContain('share a bit more detail');
  });

  it('lists collection records for natural follow-up when listContent is available', async () => {
    const deps = createDeps({
      getCollections: () => [
        {
          slug: 'users',
          shortSlug: 'users',
          label: 'Users',
          pluginSlug: 'system',
          raw: { fields: [{ name: 'id' }, { name: 'email' }] },
        },
      ],
      listContent: async () => ({
        docs: [
          { id: 1, email: 'a@example.com' },
          { id: 2, email: 'b@example.com' },
        ],
        totalDocs: 2,
      }),
    });
    const result = await OrchestratorRunner.runOrchestrator(
      {
        message: 'what users we have',
        history: [
          { role: 'user', content: 'List installed plugins, active theme, and editable collections.' },
          { role: 'assistant', content: 'Here is your current workspace inventory.' },
        ],
        checkpoint: { reason: 'user_continue', stage: 'finalize', resumePrompt: 'Continue from workspace inventory context.' },
        agentMode: 'basic',
      },
      deps,
    );

    expect((result?.message || '').toLowerCase()).toContain('found 2 records');
    expect((result?.message || '').toLowerCase()).toContain('a@example.com');
    expect(result?.model).toBe('workspace-list');
  });

  it('answers record field follow-up from listing checkpoint context', async () => {
    const deps = createDeps({
      getCollections: () => [
        {
          slug: 'users',
          shortSlug: 'users',
          label: 'Users',
          pluginSlug: 'system',
          raw: { fields: [{ name: 'id' }, { name: 'name' }, { name: 'email' }] },
        },
      ],
      listContent: async () => ({
        docs: [{ id: 1, name: 'Estows', email: 'estows@gmail.com' }],
        totalDocs: 1,
      }),
    });
    const result = await OrchestratorRunner.runOrchestrator(
      {
        message: 'what is his name ?',
        history: [
          { role: 'assistant', content: 'Found 1 record in users.\n\nSample:\n\nemail: estows@gmail.com' },
        ],
        checkpoint: { reason: 'user_continue', stage: 'finalize', resumePrompt: 'Continue from users listing context.' },
        agentMode: 'basic',
      },
      deps,
    );

    expect((result?.message || '').toLowerCase()).toContain('record 1');
    expect((result?.message || '').toLowerCase()).toContain('name: estows');
    expect(result?.model).toBe('workspace-list-followup');
  });

  it('answers listing follow-up with natural phrasing and explicit email mention', async () => {
    const deps = createDeps({
      getCollections: () => [
        {
          slug: 'users',
          shortSlug: 'users',
          label: 'Users',
          pluginSlug: 'system',
          raw: { fields: [{ name: 'id' }, { name: 'name' }, { name: 'email' }] },
        },
      ],
      listContent: async () => ({
        docs: [
          { id: 1, name: 'Other User', email: 'other@gmail.com' },
          { id: 2, name: 'Estows', email: 'estows@gmail.com' },
        ],
        totalDocs: 2,
      }),
    });
    const result = await OrchestratorRunner.runOrchestrator(
      {
        message: 'so do you know the name of estows@gmail.com ?',
        history: [
          { role: 'assistant', content: 'Found 2 records in users.\n\nSample:\n\nemail: other@gmail.com' },
        ],
        checkpoint: { reason: 'user_continue', stage: 'finalize', resumePrompt: 'Continue from users listing context.' },
        agentMode: 'basic',
      },
      deps,
    );

    expect(result?.model).toBe('workspace-list-followup');
    expect((result?.message || '').toLowerCase()).toContain('record 2');
    expect((result?.message || '').toLowerCase()).toContain('name: estows');
    expect((result?.message || '').toLowerCase()).not.toContain('share a bit more detail');
  });

  it('answers listing follow-up even when only history carries listing context (no checkpoint)', async () => {
    const deps = createDeps({
      getCollections: () => [
        {
          slug: 'users',
          shortSlug: 'users',
          label: 'Users',
          pluginSlug: 'system',
          raw: { fields: [{ name: 'id' }, { name: 'name' }, { name: 'email' }] },
        },
      ],
      listContent: async () => ({
        docs: [{ id: 1, name: 'Estows', email: 'estows@gmail.com' }],
        totalDocs: 1,
      }),
    });
    const result = await OrchestratorRunner.runOrchestrator(
      {
        message: 'so do you know the name of estows@gmail.com ?',
        history: [
          { role: 'assistant', content: 'Found 1 record in users.\n\nSample:\n\nemail: estows@gmail.com' },
        ],
        agentMode: 'basic',
      },
      deps,
    );

    expect(result?.model).toBe('workspace-list-followup');
    expect((result?.message || '').toLowerCase()).toContain('name: estows');
    expect((result?.message || '').toLowerCase()).not.toContain('share a bit more detail');
  });

  it('handles non-english listing follow-up phrasing without generic fallback', async () => {
    const deps = createDeps({
      getCollections: () => [
        {
          slug: 'users',
          shortSlug: 'users',
          label: 'Users',
          pluginSlug: 'system',
          raw: { fields: [{ name: 'id' }, { name: 'name' }, { name: 'email' }] },
        },
      ],
      listContent: async () => ({
        docs: [{ id: 1, name: 'Estows', email: 'estows@gmail.com' }],
        totalDocs: 1,
      }),
    });
    const result = await OrchestratorRunner.runOrchestrator(
      {
        message: 'cual es el nombre de estows@gmail.com?',
        history: [
          { role: 'assistant', content: 'Found 1 record in users.\n\nSample:\n\nemail: estows@gmail.com' },
        ],
        agentMode: 'basic',
      },
      deps,
    );

    expect(result?.model).toBe('workspace-list-followup');
    expect((result?.message || '').toLowerCase()).toContain('estows');
    expect((result?.message || '').toLowerCase()).not.toContain('share a bit more detail');
  });

  it('explains missing requested field in listing follow-up', async () => {
    const deps = createDeps({
      getCollections: () => [
        {
          slug: 'users',
          shortSlug: 'users',
          label: 'Users',
          pluginSlug: 'system',
          raw: { fields: [{ name: 'id' }, { name: 'email' }] },
        },
      ],
      listContent: async () => ({
        docs: [{ id: 1, email: 'estows@gmail.com' }],
        totalDocs: 1,
      }),
    });
    const result = await OrchestratorRunner.runOrchestrator(
      {
        message: 'what is his name ?',
        history: [
          { role: 'assistant', content: 'Found 1 record in users.\n\nSample:\n\nemail: estows@gmail.com' },
        ],
        checkpoint: { reason: 'user_continue', stage: 'finalize', resumePrompt: 'Continue from users listing context.' },
        agentMode: 'basic',
      },
      deps,
    );

    expect((result?.message || '').toLowerCase()).toContain('couldn');
    expect((result?.message || '').toLowerCase()).toContain('"name"');
  });

  it('resolves schema field hints without hardcoded keyword map (site_title)', async () => {
    const deps = createDeps({
      getCollections: () => [
        {
          slug: 'settings',
          shortSlug: 'settings',
          label: 'Settings',
          pluginSlug: 'system',
          raw: { fields: [{ name: 'id' }, { name: 'site_title' }, { name: 'support_email' }] },
        },
      ],
      listContent: async () => ({
        docs: [{ id: 1, site_title: 'Forge HQ', support_email: 'help@forge.com' }],
        totalDocs: 1,
      }),
    });
    const result = await OrchestratorRunner.runOrchestrator(
      {
        message: 'what is site title?',
        history: [
          { role: 'assistant', content: 'Found 1 record in settings.' },
        ],
        checkpoint: { reason: 'user_continue', stage: 'finalize', resumePrompt: 'Continue from settings listing context.' },
        agentMode: 'basic',
      },
      deps,
    );

    expect((result?.message || '').toLowerCase()).toContain('site_title: forge hq');
    expect(result?.model).toBe('workspace-list-followup');
  });

  it('uses checkpoint listing memory for ordinal follow-up (second one)', async () => {
    const deps = createDeps({
      getCollections: () => [
        {
          slug: 'users',
          shortSlug: 'users',
          label: 'Users',
          pluginSlug: 'system',
          raw: { fields: [{ name: 'id' }, { name: 'email' }] },
        },
      ],
      listContent: async () => ({
        docs: [
          { id: 1, email: 'first@example.com' },
          { id: 2, email: 'second@example.com' },
        ],
        totalDocs: 2,
      }),
    });
    const result = await OrchestratorRunner.runOrchestrator(
      {
        message: 'what is second one email?',
        history: [
          { role: 'assistant', content: 'Found 2 records in users.' },
        ],
        checkpoint: {
          reason: 'user_continue',
          stage: 'finalize',
          resumePrompt: 'Continue from users listing context.',
          memory: {
            listing: {
              collectionSlug: 'users',
              lastSelectedRowIndex: 0,
              lastSelectedRecordId: 'id:1',
              lastSelectedField: 'email',
            },
          },
        },
        agentMode: 'basic',
      },
      deps,
    );

    expect((result?.message || '').toLowerCase()).toContain('record 2');
    expect((result?.message || '').toLowerCase()).toContain('email: second@example.com');
  });

  it('reuses last selected row/field for pronoun follow-up (that one)', async () => {
    const deps = createDeps({
      getCollections: () => [
        {
          slug: 'users',
          shortSlug: 'users',
          label: 'Users',
          pluginSlug: 'system',
          raw: { fields: [{ name: 'id' }, { name: 'email' }] },
        },
      ],
      listContent: async () => ({
        docs: [
          { id: 1, email: 'first@example.com' },
          { id: 2, email: 'second@example.com' },
        ],
        totalDocs: 2,
      }),
    });
    const result = await OrchestratorRunner.runOrchestrator(
      {
        message: 'what about that one?',
        history: [
          { role: 'assistant', content: 'For users, record 2 email: second@example.com' },
        ],
        checkpoint: {
          reason: 'user_continue',
          stage: 'finalize',
          resumePrompt: 'Continue from users listing context.',
          memory: {
            listing: {
              collectionSlug: 'users',
              lastSelectedRowIndex: 1,
              lastSelectedRecordId: 'id:2',
              lastSelectedField: 'email',
            },
          },
        },
        agentMode: 'basic',
      },
      deps,
    );

    expect((result?.message || '').toLowerCase()).toContain('record 2');
    expect((result?.message || '').toLowerCase()).toContain('email: second@example.com');
  });

  it('returns workspace inventory from structured map', async () => {
    const deps = createDeps({
      getCollections: () => [
        { slug: 'users', shortSlug: 'users', label: 'Users', pluginSlug: 'system', raw: {} },
      ],
      getPlugins: () => [
        { slug: 'cms', name: 'Content Management System', version: '1.5.9', state: 'active' },
      ] as any,
      getThemes: () => [
        { slug: 'snapbilt-bundle-demo', name: 'SnapBilt Bundle Demo', version: '1.0.0', state: 'active' },
      ] as any,
    });
    const result = await OrchestratorRunner.runOrchestrator(
      {
        message: 'List installed plugins, active theme, and editable collections.',
        agentMode: 'basic',
      },
      deps,
    );

    expect((result?.message || '').toLowerCase()).toContain('workspace inventory');
    expect((result?.message || '').toLowerCase()).toContain('installed plugins');
    expect((result?.message || '').toLowerCase()).toContain('active theme');
    expect((result?.message || '').toLowerCase()).toContain('editable collections');
  });

  it('uses ai client reply for conversational chat turns when available', async () => {
    const aiClient = {
      chat: jest.fn().mockResolvedValue({
        content: 'Sure, let us chat. What is on your mind?',
        model: 'mock-chat-model',
      }),
    };
    const deps = createDeps({ aiClient: aiClient as any });
    const result = await OrchestratorRunner.runOrchestrator(
      {
        message: "let's chat",
        agentMode: 'basic',
      },
      deps,
    );

    expect(aiClient.chat).toHaveBeenCalled();
    expect(result?.message).toContain('let us chat');
    expect(result?.model).toBe('mock-chat-model');
  });

  it('uses ai client reply for greeting turns when available (no canned hey shortcut)', async () => {
    const aiClient = {
      chat: jest.fn().mockResolvedValue({
        content: 'Hey there. Ready when you are.',
        model: 'mock-chat-model',
      }),
    };
    const deps = createDeps({ aiClient: aiClient as any });
    const result = await OrchestratorRunner.runOrchestrator(
      {
        message: 'hey',
        agentMode: 'basic',
      },
      deps,
    );

    expect(aiClient.chat).toHaveBeenCalled();
    expect(result?.message).toContain('Ready when you are');
    expect(result?.model).toBe('mock-chat-model');
  });

  it('continues replace flow from clarification with url hint and stages deterministic action', async () => {
    const bridge = McpBridgeFactory.create({
      tools: [
        {
          tool: 'content.search_text',
          readOnly: true,
          handler: async () => ({
            ok: true,
            output: {
              matches: [
                {
                  collectionSlug: '@cms/pages',
                  recordId: 1,
                  field: 'phone',
                  value: '07000 000001',
                },
              ],
            },
          }),
        },
      ],
    });
    const deps = createDeps();
    const depsWithTools = {
      ...deps,
      createBridge: async () => bridge,
      listTools: async () => [{ tool: 'content.search_text', readOnly: true }],
    };

    const result = await OrchestratorRunner.runOrchestrator(
      {
        message: 'http://localhost:3000/examples/roofing',
        history: [
          { role: 'user', content: 'change "07000 000001" to "07000 000002"' },
          { role: 'assistant', content: 'Need one detail to continue.' },
        ],
        checkpoint: { reason: 'clarification_needed', stage: 'clarify', resumePrompt: 'continue' },
      },
      depsWithTools,
    );

    expect(result?.actions?.length).toBeGreaterThan(0);
    expect(result?.actions?.[0]?.tool).toBe('content.update');
    expect(String(result?.message || '').toLowerCase()).toContain('staged');
  });

  it('shows file match locations when user CliUtils.asks "where are they" after file-scope clarification', async () => {
    const bridge = McpBridgeFactory.create({
      tools: [
        {
          tool: 'themes.files.search_text',
          readOnly: true,
          handler: async () => ({
            ok: true,
            output: {
              matches: [
                {
                  slug: 'snapbilt-bundle-demo',
                  path: '/repo/themes/snapbilt-bundle-demo/src/components/Blocks.jsx',
                  value: 'Stop Losing £50k+ Leads',
                },
                {
                  slug: 'snapbilt-bundle-demo',
                  path: '/repo/themes/snapbilt-bundle-demo/src/components/examples/ApexRoofing.jsx',
                  value: 'Stop Losing £50k+ Leads',
                },
              ],
            },
          }),
        },
      ],
    });
    const deps = createDeps();
    const depsWithTools = {
      ...deps,
      createBridge: async () => bridge,
      listTools: async () => [{ tool: 'themes.files.search_text', readOnly: true }],
    };

    const result = await OrchestratorRunner.runOrchestrator(
      {
        message: 'where are they?',
        history: [
          { role: 'user', content: 'want to change "£50k+" to "£60k+"' },
          { role: 'assistant', content: 'I found file matches; choose CMS/content values or file changes.' },
        ],
        checkpoint: { reason: 'clarification_needed', stage: 'clarify', resumePrompt: 'continue' },
      },
      depsWithTools,
    );

    expect((result?.message || '').toLowerCase()).toContain('file matches');
    expect(result?.message || '').toContain('/repo/themes/snapbilt-bundle-demo/src/components/Blocks.jsx');
    expect((result?.actions || []).length).toBe(0);
    expect(result?.model).toBe('deterministic-clarify');
  });
});
