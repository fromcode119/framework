import { AdminAssistantRuntime } from '../src/admin-assistant-runtime';
import type { AssistantCollectionContext } from '../src/admin-assistant-runtime/types';

function createRuntimeHarness(input?: {
  collections?: AssistantCollectionContext[];
  resolvePromptProfile?: () => Promise<{ basicSystem?: string; advancedSystem?: string }> | { basicSystem?: string; advancedSystem?: string };
  aiResponse?: any;
  aiResponses?: any[];
  resolveContent?: any;
  listContent?: any;
  resolveAdditionalTools?: any;
}) {
  const collections = input?.collections || [];
  const aiResponses = Array.isArray(input?.aiResponses) ? [...input!.aiResponses] : [];
  if (input?.aiResponse) aiResponses.push(input.aiResponse);
  const aiClient = {
    chat: jest.fn().mockImplementation(async () => {
      if (aiResponses.length > 0) return aiResponses.shift();
      return { content: 'ok', model: 'mock-model' };
    }),
  };

  const runtime = new AdminAssistantRuntime({
    aiClient: aiClient as any,
    getCollections: () => collections,
    getPlugins: () => [],
    getThemes: () => [],
    findCollectionBySlug: (source: string) =>
      collections.find((entry) => entry.slug === source || entry.shortSlug === source) || null,
    createContent: async () => ({}),
    updateContent: async () => ({}),
    resolveContent: input?.resolveContent,
    listContent: input?.listContent,
    getSetting: async () => ({ found: false, value: null, group: null }),
    upsertSetting: async () => undefined,
    resolvePromptProfile: input?.resolvePromptProfile,
    resolveAdditionalTools: input?.resolveAdditionalTools,
  });

  return { runtime, aiClient };
}

describe('assistant-runtime behavior baseline', () => {
  it('appends custom basic prompt + enforced vibe baseline', async () => {
    const { runtime, aiClient } = createRuntimeHarness({
      resolvePromptProfile: async () => ({
        basicSystem: 'CUSTOM BASIC PROMPT LINE',
      }),
      aiResponse: { content: 'ok', model: 'mock-model' },
    });

    await runtime.chat({
      message: 'summarize available tools',
      agentMode: 'basic',
    });

    const call = (aiClient.chat as jest.Mock).mock.calls[0][0];
    const systemPrompt = String(call?.messages?.[0]?.content || '');
    expect(systemPrompt).toContain('CUSTOM BASIC PROMPT LINE');
    expect(systemPrompt).toContain("Be the assistant you'd actually want to talk to at 2am. Not a corporate drone. Not a sycophant. Just... good.");
    expect(systemPrompt).toContain('Never claim you cannot access backend data');
  });

  it('appends custom advanced prompt + enforced vibe baseline', async () => {
    const { runtime, aiClient } = createRuntimeHarness({
      resolvePromptProfile: async () => ({
        advancedSystem: 'CUSTOM ADVANCED PROMPT LINE',
      }),
      aiResponse: {
        content: JSON.stringify({ message: 'done', done: true, toolCalls: [], actions: [] }),
        model: 'mock-model',
      },
    });

    await runtime.chat({
      message: 'do a quick plan',
      agentMode: 'advanced',
      maxIterations: 1,
    });

    const call = (aiClient.chat as jest.Mock).mock.calls[0][0];
    const systemPrompt = String(call?.messages?.[0]?.content || '');
    expect(systemPrompt).toContain('CUSTOM ADVANCED PROMPT LINE');
    expect(systemPrompt).toContain("Never open with Great question, I'd be happy to help, or Absolutely. Just answer.");
    expect(systemPrompt).toContain('Return STRICT JSON only with this shape');
  });

  it('strips banned opener phrases from final output', async () => {
    const { runtime } = createRuntimeHarness({
      aiResponse: {
        content: "Great question, I'd be happy to help. Absolutely. Here is the answer.",
        model: 'mock-model',
      },
    });

    const result = await runtime.chat({
      message: 'Give me a quick answer',
      agentMode: 'basic',
    });

    expect(result.message.toLowerCase()).not.toMatch(/^great question|^i['’]d be happy to help|^absolutely/);
    expect(result.message).toContain('Here is the answer');
  });

  it('returns targeted clarification with checkpoint when loop caps without actions', async () => {
    const { runtime } = createRuntimeHarness({
      aiResponse: {
        content: JSON.stringify({ message: 'Working on it', done: false, toolCalls: [], actions: [] }),
        model: 'mock-model',
      },
    });

    const result = await runtime.chat({
      message: 'Update the hero copy on the homepage',
      agentMode: 'advanced',
      maxIterations: 1,
    });

    expect(result.ui?.needsClarification).toBe(true);
    expect(result.ui?.clarifyingQuestion).toBeTruthy();
    expect(result.ui?.canContinue).toBe(false);
    expect(result.checkpoint?.reason).toBe('clarification_needed');
    expect(result.message.toLowerCase()).not.toContain('one more pass');
  });

  it('keeps continue flow for read-only discovery pauses', async () => {
    const { runtime } = createRuntimeHarness({
      aiResponse: {
        content: JSON.stringify({ message: 'Checking current value', done: false, toolCalls: [], actions: [] }),
        model: 'mock-model',
      },
    });

    const result = await runtime.chat({
      message: 'Where is the homepage hero text?',
      agentMode: 'advanced',
      maxIterations: 1,
    });

    expect(result.ui?.needsClarification).toBe(false);
    expect(result.ui?.canContinue).toBe(true);
    expect(result.checkpoint?.reason).toBe('loop_cap');
  });

  it('keeps safety approvals for staged writes', async () => {
    const collection: AssistantCollectionContext = {
      slug: '@cms/pages',
      shortSlug: 'pages',
      label: 'Pages',
      pluginSlug: 'cms',
      raw: { primaryKey: 'id', fields: [{ name: 'id' }, { name: 'title' }, { name: 'content' }] },
    };
    const { runtime } = createRuntimeHarness({
      collections: [collection],
      resolveContent: async () => ({ id: 1, title: 'Home' }),
      aiResponse: {
        content: JSON.stringify({
          message: 'Staged one update',
          done: true,
          toolCalls: [],
          actions: [
            {
              type: 'mcp_call',
              tool: 'content.update',
              input: {
                collectionSlug: '@cms/pages',
                id: 1,
                data: { title: 'New Home' },
              },
            },
          ],
        }),
        model: 'mock-model',
      },
    });

    const result = await runtime.chat({
      message: 'Stage a page title edit for the homepage record',
      agentMode: 'advanced',
      maxIterations: 1,
      skillId: 'general',
    });

    expect(Array.isArray(result.actions) ? result.actions.length : 0).toBeGreaterThan(0);
    expect(result.ui?.requiresApproval).toBe(true);
  });

  it('drops staged content.update payload keys not defined in collection fields', async () => {
    const collection: AssistantCollectionContext = {
      slug: '@cms/pages',
      shortSlug: 'pages',
      label: 'Pages',
      pluginSlug: 'cms',
      raw: { primaryKey: 'id', fields: [{ name: 'id' }, { name: 'title' }, { name: 'content' }] },
    };
    const { runtime } = createRuntimeHarness({
      collections: [collection],
      resolveContent: async () => ({ id: 1, title: 'Home', content: 'Welcome' }),
      aiResponse: {
        content: JSON.stringify({
          message: 'Staged one update',
          done: true,
          toolCalls: [],
          actions: [
            {
              type: 'mcp_call',
              tool: 'content.update',
              input: {
                collectionSlug: '@cms/pages',
                id: 1,
                data: { label: 'Elite UK Contractors' },
              },
            },
          ],
        }),
        model: 'mock-model',
      },
    });

    const result = await runtime.chat({
      message: 'Update @cms/pages id 1 field label to "Elite UK Contractors"',
      agentMode: 'advanced',
      maxIterations: 1,
    });

    expect(result.actions || []).toHaveLength(0);
  });

  it('returns instant clarification for vague change requests without model loop', async () => {
    const { runtime, aiClient } = createRuntimeHarness({
      aiResponse: {
        content: JSON.stringify({ message: 'should not be used', done: false, toolCalls: [], actions: [] }),
        model: 'mock-model',
      },
    });

    const result = await runtime.chat({
      message: 'can you help me with one change',
      agentMode: 'advanced',
      maxIterations: 8,
      maxDurationMs: 35000,
    });

    expect(result.ui?.needsClarification).toBe(true);
    expect(result.checkpoint?.reason).toBe('clarification_needed');
    expect((aiClient.chat as jest.Mock).mock.calls.length).toBe(0);
  });

  it('returns instant clarification for vague change requests in basic mode too', async () => {
    const { runtime, aiClient } = createRuntimeHarness({
      aiResponse: { content: 'should not run', model: 'mock-model' },
    });

    const result = await runtime.chat({
      message: 'help me change something',
      agentMode: 'basic',
    });

    expect(result.ui?.needsClarification).toBe(true);
    expect(result.checkpoint?.reason).toBe('clarification_needed');
    expect((aiClient.chat as jest.Mock).mock.calls.length).toBe(0);
  });

  it('returns homepage draft fast-path without model call in basic mode', async () => {
    const collection: AssistantCollectionContext = {
      slug: '@cms/pages',
      shortSlug: 'pages',
      label: 'Pages',
      pluginSlug: 'cms',
      raw: { primaryKey: 'id', fields: [{ name: 'id' }, { name: 'title' }, { name: 'content' }] },
    };
    const { runtime, aiClient } = createRuntimeHarness({
      collections: [collection],
      resolveContent: async () => ({ id: 1, slug: 'home', title: 'Home' }),
      aiResponse: { content: 'should not run', model: 'mock-model' },
    });

    const result = await runtime.chat({
      message: 'Create a homepage draft with hero, proof, CTA, and FAQ.',
      agentMode: 'basic',
    });

    expect(result.message).toContain('## Hero');
    expect((result.actions || []).length).toBeGreaterThan(0);
    expect(result.message.toLowerCase()).toContain('live homepage stays untouched');
    expect((result.actions || [])[0]?.tool).toBe('content.create');
    expect((aiClient.chat as jest.Mock).mock.calls.length).toBe(0);
  });

  it('uses content.update for homepage draft only when target record is explicit', async () => {
    const collection: AssistantCollectionContext = {
      slug: '@cms/pages',
      shortSlug: 'pages',
      label: 'Pages',
      pluginSlug: 'cms',
      raw: { primaryKey: 'id', fields: [{ name: 'id' }, { name: 'title' }, { name: 'content' }] },
    };
    const { runtime, aiClient } = createRuntimeHarness({
      collections: [collection],
      resolveContent: async (_collection: AssistantCollectionContext, selector: { id?: string | number }) =>
        selector?.id === 8 ? { id: 8, slug: 'home', title: 'Home' } : null,
      aiResponse: { content: 'should not run', model: 'mock-model' },
    });

    const result = await runtime.chat({
      message: 'Create homepage draft in @cms/pages id 8 with hero, proof, CTA, and FAQ.',
      agentMode: 'basic',
    });

    expect((result.actions || []).length).toBeGreaterThan(0);
    expect((result.actions || [])[0]?.tool).toBe('content.update');
    expect((result.actions || [])[0]?.input?.id).toBe(8);
    expect((aiClient.chat as jest.Mock).mock.calls.length).toBe(0);
  });

  it('parses conversational replace phrasing and avoids freeform model staging', async () => {
    const collection: AssistantCollectionContext = {
      slug: '@cms/pages',
      shortSlug: 'pages',
      label: 'Pages',
      pluginSlug: 'cms',
      raw: { primaryKey: 'id', fields: [{ name: 'id' }, { name: 'title' }, { name: 'content' }] },
    };
    const { runtime, aiClient } = createRuntimeHarness({
      collections: [collection],
      listContent: async () => ({ docs: [], totalDocs: 0, limit: 80, offset: 0 }),
      aiResponse: { content: 'should not run', model: 'mock-model' },
    });

    const result = await runtime.chat({
      message: 'can you change also the phone "07000 000000" to "07000 000001"',
      agentMode: 'advanced',
    });

    expect(result.traces?.[0]?.message || '').toContain('exact text search');
    expect((aiClient.chat as jest.Mock).mock.calls.length).toBe(0);
  });

  it('parses multiline percentage change requests as deterministic replace intent', async () => {
    const { runtime, aiClient } = createRuntimeHarness({
      aiResponse: { content: 'should not run', model: 'mock-model' },
    });

    const result = await runtime.chat({
      message: `change Value Impact

+15%

Property Equity to +20%`,
      agentMode: 'advanced',
    });

    expect(result.traces?.[0]?.message || '').toContain('exact text search');
    expect((result.message || '').toLowerCase()).not.toContain('need one detail to finish staging');
    expect((aiClient.chat as jest.Mock).mock.calls.length).toBe(0);
  });

  it('continues deterministic replace from history when user follow-up is short', async () => {
    const { runtime, aiClient } = createRuntimeHarness({
      aiResponse: { content: 'should not run', model: 'mock-model' },
    });

    const result = await runtime.chat({
      message: 'ok change it',
      agentMode: 'advanced',
      history: [
        {
          role: 'user',
          content: `change Value Impact

+15%

Property Equity to +20%`,
        },
        {
          role: 'assistant',
          content: 'Need one detail to finish staging: share collection + record id/slug + field path + new value.',
        },
        {
          role: 'user',
          content: "it's here http://localhost:3000/examples/roofing",
        },
      ],
    });

    expect(result.traces?.[0]?.message || '').toContain('exact text search');
    expect((result.message || '').toLowerCase()).not.toContain('need one detail to finish staging');
    expect((aiClient.chat as jest.Mock).mock.calls.length).toBe(0);
  });

  it('accepts typo variant "chage ... to ..." as deterministic replace intent', async () => {
    const { runtime, aiClient } = createRuntimeHarness({
      aiResponse: { content: 'should not run', model: 'mock-model' },
    });

    const result = await runtime.chat({
      message: 'chage 07000 000001 to "07000 000002"',
      agentMode: 'advanced',
    });

    expect(result.traces?.[0]?.message || '').toContain('exact text search');
    expect((result.message || '').toLowerCase()).not.toContain('need one detail to finish staging');
    expect((aiClient.chat as jest.Mock).mock.calls.length).toBe(0);
  });

  it('stages plugin file replacement when hardcoded value is found in source files', async () => {
    const { runtime, aiClient } = createRuntimeHarness({
      resolveAdditionalTools: async () => [
        {
          tool: 'plugins.files.search_text',
          readOnly: true,
          description: 'Search plugin files',
          handler: async (input: any) => ({
            query: String(input?.query || ''),
            matches: String(input?.query || '') === '07000 000000'
              ? [
                  {
                    slug: 'sample-plugin',
                    path: '/repo/plugins/sample-plugin/src/contact.ts',
                    line: 12,
                    column: 18,
                    value: 'const phone = "07000 000000";',
                  },
                ]
              : [],
            totalMatches: String(input?.query || '') === '07000 000000' ? 1 : 0,
            truncated: false,
          }),
        },
        {
          tool: 'plugins.files.replace_text',
          readOnly: false,
          description: 'Replace text in plugin file',
          handler: async () => ({ dryRun: true }),
        },
      ],
      aiResponse: { content: 'should not run', model: 'mock-model' },
    });

    const result = await runtime.chat({
      message: 'can you change also the phone "07000 000000" to "07000 000001"',
      agentMode: 'advanced',
    });

    expect((result.actions || []).some((action: any) => action?.tool === 'plugins.files.replace_text')).toBe(true);
    expect((result.message || '').toLowerCase()).toContain('staged');
    expect((aiClient.chat as jest.Mock).mock.calls.length).toBe(0);
  });

  it('CliUtils.asks for target scope when only multiple file replacements are found', async () => {
    const { runtime, aiClient } = createRuntimeHarness({
      resolveAdditionalTools: async () => [
        {
          tool: 'themes.files.search_text',
          readOnly: true,
          description: 'Search theme files',
          handler: async (input: any) => ({
            query: String(input?.query || ''),
            matches: String(input?.query || '').toLowerCase() === 'value impact +15% property equity'
              ? [
                  {
                    slug: 'snapbilt-bundle-demo',
                    path: '/repo/themes/snapbilt-bundle-demo/src/components/examples/ApexRoofing.jsx',
                    line: 44,
                    column: 20,
                    value: 'Value Impact +15% Property Equity',
                  },
                  {
                    slug: 'snapbilt-bundle-demo',
                    path: '/repo/themes/snapbilt-bundle-demo/src/components/examples/SurreySolar.jsx',
                    line: 52,
                    column: 18,
                    value: 'Value Impact +15% Property Equity',
                  },
                ]
              : [],
            totalMatches: String(input?.query || '').toLowerCase() === 'value impact +15% property equity' ? 2 : 0,
            truncated: false,
          }),
        },
        {
          tool: 'themes.files.replace_text',
          readOnly: false,
          description: 'Replace text in theme file',
          handler: async () => ({ dryRun: true }),
        },
      ],
      aiResponse: { content: 'should not run', model: 'mock-model' },
    });

    const result = await runtime.chat({
      message: 'change Value Impact +15% Property Equity to +20%',
      agentMode: 'advanced',
    });

    expect((result.actions || []).length).toBe(0);
    expect((result.message || '').toLowerCase()).toContain('cms/content');
    expect((aiClient.chat as jest.Mock).mock.calls.length).toBe(0);
  });

  it('prefers plugin settings update over file replacement when managed target exists', async () => {
    const { runtime, aiClient } = createRuntimeHarness({
      resolveAdditionalTools: async () => [
        {
          tool: 'plugins.settings.search_text',
          readOnly: true,
          description: 'Search plugin settings',
          handler: async (input: any) => ({
            query: String(input?.query || ''),
            matches: String(input?.query || '') === '07000 000000'
              ? [{ slug: 'sample-plugin', path: 'config.phone', value: '07000 000000' }]
              : [],
            totalMatches: String(input?.query || '') === '07000 000000' ? 1 : 0,
            truncated: false,
          }),
        },
        {
          tool: 'plugins.settings.get',
          readOnly: true,
          description: 'Get plugin settings',
          handler: async () => ({
            slug: 'sample-plugin',
            config: { phone: '07000 000000' },
          }),
        },
        {
          tool: 'plugins.settings.update',
          readOnly: false,
          description: 'Update plugin settings',
          handler: async () => ({ dryRun: true }),
        },
        {
          tool: 'plugins.files.search_text',
          readOnly: true,
          description: 'Search plugin files',
          handler: async (input: any) => ({
            query: String(input?.query || ''),
            matches: String(input?.query || '') === '07000 000000'
              ? [
                  {
                    slug: 'sample-plugin',
                    path: '/repo/plugins/sample-plugin/src/contact.ts',
                    line: 12,
                    column: 18,
                    value: 'const phone = "07000 000000";',
                  },
                ]
              : [],
            totalMatches: String(input?.query || '') === '07000 000000' ? 1 : 0,
            truncated: false,
          }),
        },
        {
          tool: 'plugins.files.replace_text',
          readOnly: false,
          description: 'Replace text in plugin file',
          handler: async () => ({ dryRun: true }),
        },
      ],
      aiResponse: { content: 'should not run', model: 'mock-model' },
    });

    const result = await runtime.chat({
      message: 'can you change also the phone "07000 000000" to "07000 000001"',
      agentMode: 'advanced',
    });

    const tools = (result.actions || []).map((action: any) => String(action?.tool || ''));
    expect(tools).toContain('plugins.settings.update');
    expect(tools).not.toContain('plugins.files.replace_text');
    expect((aiClient.chat as jest.Mock).mock.calls.length).toBe(0);
  });

  it('reports blocked search tools instead of claiming a full replace scan', async () => {
    const { runtime, aiClient } = createRuntimeHarness({
      aiResponse: { content: 'should not run', model: 'mock-model' },
    });

    const result = await runtime.chat({
      message: 'can you change also the phone "07000 000000" to "07000 000001"',
      agentMode: 'advanced',
      skillId: 'research',
    });

    expect(result.message).toContain('could not run');
    expect(result.message).toContain('"Content Search"');
    expect(result.message).not.toContain('I searched content, plugin settings, and theme config');
    expect((result.actions || []).length).toBe(0);
    expect((aiClient.chat as jest.Mock).mock.calls.length).toBe(0);
  });

  it('uses expanded maxFiles budget for deterministic plugin/theme file search in replace fast-path', async () => {
    const observedMaxFiles: number[] = [];
    const { runtime, aiClient } = createRuntimeHarness({
      resolveAdditionalTools: async () => [
        {
          tool: 'plugins.files.search_text',
          readOnly: true,
          description: 'Search plugin files',
          handler: async (input: any) => {
            observedMaxFiles.push(Number(input?.maxFiles || 0));
            return { query: String(input?.query || ''), matches: [], totalMatches: 0, truncated: false };
          },
        },
        {
          tool: 'themes.files.search_text',
          readOnly: true,
          description: 'Search theme files',
          handler: async (input: any) => {
            observedMaxFiles.push(Number(input?.maxFiles || 0));
            return { query: String(input?.query || ''), matches: [], totalMatches: 0, truncated: false };
          },
        },
      ],
      aiResponse: { content: 'should not run', model: 'mock-model' },
    });

    await runtime.chat({
      message: 'can you change also the phone "07000 000000" to "07000 000001"',
      agentMode: 'advanced',
    });

    expect(observedMaxFiles.length).toBeGreaterThan(0);
    expect(Math.min(...observedMaxFiles)).toBeGreaterThanOrEqual(10000);
    expect((aiClient.chat as jest.Mock).mock.calls.length).toBe(0);
  });

  it('returns instant greeting guidance without model call', async () => {
    const { runtime, aiClient } = createRuntimeHarness({
      aiResponse: { content: 'should not run', model: 'mock-model' },
    });

    const result = await runtime.chat({
      message: 'hey',
      agentMode: 'basic',
    });

    expect(result.message.toLowerCase()).toContain('we can chat');
    expect((aiClient.chat as jest.Mock).mock.calls.length).toBe(0);
  });

  it('does not force greeting fast-path when conversation already has context', async () => {
    const { runtime, aiClient } = createRuntimeHarness({
      aiResponse: { content: 'Hey again. What do you want to work on?', model: 'mock-model' },
    });

    const result = await runtime.chat({
      message: 'hey',
      agentMode: 'basic',
      history: [
        { role: 'user', content: 'hey' },
        { role: 'assistant', content: 'previous answer' },
      ],
    });

    expect(result.message.toLowerCase()).toContain('hey again');
    expect((aiClient.chat as jest.Mock).mock.calls.length).toBe(1);
  });
});
