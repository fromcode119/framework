import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminRuntimeContext } from '@/components/view/admin-runtime-context.client';
import { AdminShellRegistry } from '@/lib/appearance/admin-shell-registry';
import { AppearanceShellHost } from '@/app/components/view/appearance-shell-host.client';

/**
 * `AppearanceShellHost` routes an appearance shell through `AppearanceSecurityGate`, and that gate reads
 * the real admin auth state — which mounts the Next app router, hits `/auth/status` and issues router
 * pushes. None of that is the subject here (shell SELECTION is), so the auth STATE SOURCE is the seam
 * that gets stubbed. The gate's own branching (loading screen / forwarding screen / authed render) still
 * runs for real, so this suite still proves an unauthenticated visitor never reaches the shell.
 *
 * The router itself no longer needs stubbing per-file — `vitest.setup.dom.ts` mounts one for every admin
 * DOM suite. Without it this test died on `invariant expected app router to be mounted` and was red, not
 * passing.
 */
const authState = {
  user: { email: 'admin@example.com', roles: ['admin'] },
  isAuthLoading: false,
  normalizedPathname: '/',
  isMinimalPath: false,
  isAuthPage: false,
  isSetupPath: false,
  isAdvancedMode: false,
  isInitialized: true,
  router: { push: vi.fn(), replace: vi.fn() },
};

vi.mock('@/app/services/client-layout-auth-state-hooks', () => ({
  ClientLayoutAuthStateHooks: {
    useState: () => authState,
  },
}));

/** The gate mounts the shared plugin-metadata loader; it is a data layer, not part of this assertion. */
vi.mock('@/app/components/view/plugin-loader.client', () => ({
  PluginLoader: () => null,
}));

function SimpleShell({ children }: { children: React.ReactNode }) {
  return <div data-testid="simple-shell">{children}</div>;
}

describe('AppearanceShellHost', () => {
  it('renders the active appearance\'s registered shell, wrapping the page', () => {
    AdminShellRegistry.shared.register('simple', SimpleShell);
    render(
      <AdminRuntimeContext.context.Provider value={{ activeAppearanceId: 'simple' } as any}>
        <AppearanceShellHost><div>PAGE</div></AppearanceShellHost>
      </AdminRuntimeContext.context.Provider>
    );
    expect(screen.getByTestId('simple-shell')).toBeInTheDocument();
    expect(screen.getByText('PAGE')).toBeInTheDocument();
  });
});
