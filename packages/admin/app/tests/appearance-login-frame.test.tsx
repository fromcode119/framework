import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminRuntimeContext } from '@/components/view/admin-runtime-context.client';
import { AdminPageKeys } from '@/lib/appearance/admin-page-keys';
import { AdminPageRegistry } from '@/lib/appearance/admin-page-registry';

/**
 * An appearance renders its OWN sign-in — layout, inputs, button — from the framework's login
 * controller. These assertions are about what that controller does and does not hand over: it must be
 * enough to build any of the designs people ask for, and never enough to manufacture a session.
 *
 * The gate that keeps the page itself session-less-only is asserted in appearance-shell-host.test.tsx;
 * this file is about the contract handed to the appearance.
 */
vi.mock('@/lib/api', () => ({
  AdminApi: { get: vi.fn().mockResolvedValue({ initialized: true }), post: vi.fn(), put: vi.fn() },
}));

const workspace = { id: 'chi-app', slug: 'chi-app', appearance: 'chi' };
vi.mock('@/lib/tenants/host-info-client', () => ({
  HostInfoClient: { workspace: () => Promise.resolve(workspace) },
}));

import { LoginPage } from '@/app/login/page.client';

let propsSeen: Record<string, unknown> = {};
const CustomLogin = (props: any) => {
  propsSeen = props;
  return <div data-testid="custom-login">CHI SIGN IN</div>;
};

const renderLogin = () => render(
  <AdminRuntimeContext.context.Provider
    value={{ activeAppearanceId: 'chi', plugins: { collections: [] }, notify: { addNotification: vi.fn(), notify: vi.fn() }, globalSettings: {}, collections: [], auth: { user: null } } as any}
  >
    <LoginPage />
  </AdminRuntimeContext.context.Provider>,
);

describe('appearance-owned sign-in', () => {
  beforeEach(() => {
    propsSeen = {};
    AdminPageRegistry.shared.registerForAppearance('chi', AdminPageKeys.LOGIN_FRAME, CustomLogin as any);
  });

  it('lets the appearance render the whole page', async () => {
    renderLogin();
    await waitFor(() => expect(screen.queryByTestId('custom-login')).not.toBeNull());
    // The framework's own form is NOT also on the page — the appearance replaced it, not decorated it.
    expect(document.querySelector('.fc-login__card')).toBeNull();
  });

  it('hands it the controller and nothing else', async () => {
    renderLogin();
    await waitFor(() => expect(Object.keys(propsSeen).length).toBeGreaterThan(0));
    expect(Object.keys(propsSeen)).toEqual(['login']);
  });

  it('gives it no way to manufacture a session', async () => {
    renderLogin();
    await waitFor(() => expect(propsSeen.login).toBeDefined());
    const login = propsSeen.login as Record<string, unknown>;
    // Everything that decides WHO you are stays with the framework: the token, the user, the session.
    for (const forbidden of ['token', 'setToken', 'user', 'setUser', 'authenticate', 'session', 'signIn', 'logout']) {
      expect(login[forbidden]).toBeUndefined();
    }
    // What it does get: the values, the setters and the framework's own submit.
    for (const granted of ['email', 'password', 'setEmail', 'setPassword', 'submit', 'isLoading', 'error']) {
      expect(login[granted]).toBeDefined();
    }
    expect(typeof login.submit).toBe('function');
  });

  it('tells it which workspace the domain serves', async () => {
    renderLogin();
    await waitFor(() => expect((propsSeen.login as any)?.workspace).toBe('chi-app'));
  });
});
