import { renderHook, waitFor } from '@testing-library/react';
import { ContextProviderI18nHooks } from '@react/context/context-provider-i18n-hooks';

/**
 * The console asks for the platform's language first and the reader's once it knows it. With both
 * requests in flight, a late English answer replaced the Bulgarian one, and every plugin screen whose
 * copy comes from the server read English in a Bulgarian console until the next load.
 */
describe('ContextProviderI18nHooks — answers for a locale no longer asked for', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => { resolve = r; });
    return { promise, resolve };
  }

  it('keeps the current locale when an earlier request answers last', async () => {
    const answers: Record<string, ReturnType<typeof deferred<Record<string, unknown>>>> = { en: deferred(), bg: deferred() };
    const api = { get: vi.fn((url: string) => answers[new URL(url, 'http://x.test').searchParams.get('locale') as string].promise) };
    const setTranslations = vi.fn();
    const shared = {
      api,
      translations: {},
      registeredTranslations: {},
      themeTranslations: {},
      loadedConfigPathsRef: { current: new Set<string>() },
      setTranslations,
      setRefreshVersion: vi.fn(),
      setSlots: vi.fn(),
      setOverrides: vi.fn(),
      setMenuItems: vi.fn(),
      setSecondaryPanel: vi.fn(),
      setCollections: vi.fn(),
    };

    const { rerender } = renderHook(({ locale }) => ContextProviderI18nHooks.useI18nRuntime({ ...shared, locale }), { initialProps: { locale: 'en' } });
    rerender({ locale: 'bg' });

    answers.bg.resolve({ plugin: { title: 'Нумерологичен пакет' } });
    await waitFor(() => expect(setTranslations).toHaveBeenCalledWith({ plugin: { title: 'Нумерологичен пакет' } }));
    answers.en.resolve({ plugin: { title: 'Numerology suite' } });
    await new Promise((r) => setTimeout(r, 0));

    expect(setTranslations).toHaveBeenCalledTimes(1);
  });
});
