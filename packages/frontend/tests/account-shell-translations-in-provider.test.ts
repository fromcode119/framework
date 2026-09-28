// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClientType } from '@fromcode119/core/client';
import { PluginApiRegistryStore } from '@fromcode119/react/context/plugin-api-registry-store';
import { PluginsProviderSeed } from '@fromcode119/react/context/plugins-provider-seed';
import { PreBootRegistrationSeed } from '@fromcode119/react/context/pre-boot-registration-seed';
import { PluginsProvider } from '@fromcode119/react/context/view/plugins-provider.client';
import { ContextBridge } from '@fromcode119/react/context-bridge';
import { AccountShellDefault } from '@fromcode119/react/account/account-shell-default';
import { AccountTranslations } from '@fromcode119/react/account/account-translations';
import BG from '@fromcode119/react/account/i18n/bg.json';

/**
 * The signed-in account shell, rendered inside the REAL provider on a Bulgarian site.
 *
 * The account copy is registered when `AccountTranslations` is evaluated — before any provider exists —
 * and never from a `render()`. These pin both halves: the copy reaches the provider (through the seed on
 * the islands path, through the live install's flush on the App Router path), and nothing updates the
 * provider while another component renders.
 */
class AccountShellInProviderFixture {
  static root: Root | null = null;
  static container: HTMLElement | null = null;

  static seed(registrations: PreBootRegistrationSeed): PluginsProviderSeed {
    return PluginsProviderSeed.fromFrontendConfig({
      config: { activeTheme: { slug: 'demo' }, plugins: [] },
      registrations,
      translations: {},
      locale: 'bg',
      pluginApiStore: new PluginApiRegistryStore(),
      events: new Map(),
    });
  }

  /**
   * A fresh page: no bridge installed yet (it is static state, and an earlier test's provider is gone),
   * the document in Bulgarian as the layout would set it, and the account copy registered exactly as
   * module evaluation does it.
   */
  static freshPage(): void {
    ContextBridge.install(null as never);
    document.documentElement.lang = 'bg';
    window.history.replaceState({}, '', '/account/email-preferences');
    (window as any)._fromcodeQueue = [];
    (AccountTranslations as any).registered = false;
    AccountTranslations.register();
  }

  static async mount(seed: PluginsProviderSeed): Promise<HTMLElement> {
    const container = document.createElement('div');
    document.body.appendChild(container);
    AccountShellInProviderFixture.container = container;
    AccountShellInProviderFixture.root = createRoot(container);
    await act(async () => {
      AccountShellInProviderFixture.root!.render(createElement(
        PluginsProvider,
        { apiUrl: 'http://api.test', clientType: ClientType.FRONTEND_UI, seed } as never,
        createElement(AccountShellDefault),
      ));
    });
    return container;
  }

  /** Every "Cannot update a component … while rendering a different component" React reported. */
  static renderPhaseUpdates(spy: ReturnType<typeof vi.spyOn>): unknown[][] {
    return spy.mock.calls.filter((call: unknown[]) => String(call[0]).includes('Cannot update a component'));
  }
}

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  act(() => AccountShellInProviderFixture.root?.unmount());
  AccountShellInProviderFixture.container?.remove();
  AccountShellInProviderFixture.root = null;
  vi.restoreAllMocks();
  delete (window as any)._fromcodeQueue;
});

describe('account shell copy inside the provider', () => {
  const account = (BG as Record<string, any>).account;

  it('the islands path: the copy registered at evaluation is in the seed, so the first render is Bulgarian', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(() => undefined));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    AccountShellInProviderFixture.freshPage();

    const container = await AccountShellInProviderFixture.mount(
      AccountShellInProviderFixture.seed(PreBootRegistrationSeed.consume(window as never)),
    );

    expect(container.textContent).toContain(account.shell.title);
    expect(container.textContent).toContain(account.section.overview);
    expect(container.textContent).toContain(account.section.emailPreferences);
    expect(container.textContent).toContain(account.emailPreferences.empty);
    expect(container.textContent).toContain(account.emailPreferences.transactionalNote);
    expect(AccountShellInProviderFixture.renderPhaseUpdates(consoleError)).toEqual([]);
  });

  it('the App Router path: the queued copy is flushed by the live install and the shell turns Bulgarian', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(() => undefined));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    AccountShellInProviderFixture.freshPage();

    const container = await AccountShellInProviderFixture.mount(AccountShellInProviderFixture.seed(PreBootRegistrationSeed.empty()));

    expect(container.textContent).toContain(account.shell.title);
    expect(container.textContent).toContain(account.section.security);
    expect(container.textContent).toContain(account.emailPreferences.empty);
    expect(container.textContent).toContain(account.emailPreferences.transactionalNote);
    expect(AccountShellInProviderFixture.renderPhaseUpdates(consoleError)).toEqual([]);
  });
});
