// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Translations registered before the provider installs the bridge must reach it — which is what lets the
 * account copy be registered when its module is evaluated instead of from a `render()` (where updating
 * the provider is a cross-component update React rejects).
 *
 * Each test imports fresh modules: `ContextBridge` holds its install as static state, and
 * `AccountTranslations` registers on evaluation.
 */
class EarlyTranslationsFixture {
  static readonly QUEUE_KEY = '_fromcodeQueue';

  static get queue(): any[] {
    return ((window as unknown as Record<string, any>)[EarlyTranslationsFixture.QUEUE_KEY] || []) as any[];
  }

  static reset(): void {
    delete (window as unknown as Record<string, any>)[EarlyTranslationsFixture.QUEUE_KEY];
    vi.resetModules();
  }
}

describe('ContextBridge.registerTranslations before the bridge is installed', () => {
  afterEach(() => EarlyTranslationsFixture.reset());

  it('queues the registration instead of dropping it', async () => {
    EarlyTranslationsFixture.reset();
    const { ContextBridge } = await import('@fromcode119/react/context-bridge');

    ContextBridge.registerTranslations({ en: { a: { b: 'B' } } }, 'theme');

    expect(EarlyTranslationsFixture.queue).toEqual([{ type: 'translations', args: [{ en: { a: { b: 'B' } } }, 'theme'] }]);
  });

  it('delegates to the installed bridge and queues nothing once installed', async () => {
    EarlyTranslationsFixture.reset();
    const { ContextBridge } = await import('@fromcode119/react/context-bridge');
    const registerTranslations = vi.fn();
    ContextBridge.install({ registerTranslations } as any);

    ContextBridge.registerTranslations({ en: { a: 'A' } });

    expect(registerTranslations).toHaveBeenCalledWith({ en: { a: 'A' } });
    expect(EarlyTranslationsFixture.queue).toEqual([]);
  });

  it('the account copy registered at module evaluation folds into the provider seed', async () => {
    EarlyTranslationsFixture.reset();
    await import('@fromcode119/react/account/account-translations');
    const { PreBootRegistrationSeed } = await import('@fromcode119/react/context/pre-boot-registration-seed');
    const BG = (await import('@fromcode119/react/account/i18n/bg.json')).default as Record<string, any>;

    expect(EarlyTranslationsFixture.queue).toHaveLength(1);
    const seed = PreBootRegistrationSeed.consume(window as unknown as Record<string, any>);

    expect(seed.registeredTranslations.bg?.account?.emailPreferences).toEqual(BG.account.emailPreferences);
    expect(EarlyTranslationsFixture.queue).toEqual([]);
  });

  it('registers the account copy once, however many surfaces call register()', async () => {
    EarlyTranslationsFixture.reset();
    const { AccountTranslations } = await import('@fromcode119/react/account/account-translations');

    AccountTranslations.register();
    AccountTranslations.register();

    expect(EarlyTranslationsFixture.queue).toHaveLength(1);
  });
});
