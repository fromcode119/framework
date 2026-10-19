import { renderHook } from '@testing-library/react';
import { ClientType } from '@fromcode119/core/client';
import { ContextProviderApiHooks } from '@react/context/context-provider-api-hooks';
import { ContextProviderStateService } from '@react/context/context-provider-state-service';

/**
 * A reader opened a sign-in link, the player enrolled them and read their enrollments again. The read
 * came back from the five-second GET cache — the list from before the enrollment — so the player
 * treated the new student as a guest and skipped the questions asked before the first chapter.
 */
describe('ContextProviderApiHooks — a write forgets the reads remembered before it', () => {
  afterEach(() => {
    ContextProviderStateService.forgetGetResponses();
    vi.unstubAllGlobals();
  });

  function renderApi() {
    const noop = vi.fn();
    const { result } = renderHook(() => ContextProviderApiHooks.useApiRuntime({
      apiUrl: 'http://api.test',
      clientType: ClientType.FRONTEND_UI,
      browserState: { readCookie: () => '' } as any,
      locale: 'en',
      settings: {},
      setServerRuntimeModules: noop,
      setPlugins: noop,
      setCollections: noop,
      setMenuItems: noop,
      setSecondaryPanel: noop,
      setSettings: noop,
      setActiveTheme: noop,
      setThemeVariables: noop,
      setIsReady: noop,
      inFlightConfigLoadsRef: { current: new Map() },
      loadedConfigPathsRef: { current: new Set() },
      stabilityRef: { current: {} },
    }));
    return result.current.api;
  }

  it('answers a read after a POST from the server, not from the cache', async () => {
    let enrolled = false;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') enrolled = true;
      return new Response(JSON.stringify({ data: enrolled ? [{ id: 1 }] : [] }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const api = renderApi();

    expect(await api.get('/my/enrollments')).toEqual({ data: [] });
    expect(await api.get('/my/enrollments')).toEqual({ data: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await api.post('/courses/1/enroll', {});
    expect(await api.get('/my/enrollments')).toEqual({ data: [{ id: 1 }] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('forgets a remembered failure too', async () => {
    let enrolled = false;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') { enrolled = true; return new Response('{}', { status: 200 }); }
      return enrolled
        ? new Response(JSON.stringify({ questions: [] }), { status: 200 })
        : new Response(JSON.stringify({ error: 'Not enrolled' }), { status: 403 });
    }));
    const api = renderApi();

    await expect(api.get('/courses/1/intake', { silent: true })).rejects.toThrow('Not enrolled');
    await api.post('/courses/1/enroll', {});
    expect(await api.get('/courses/1/intake', { silent: true })).toEqual({ questions: [] });
  });
});
