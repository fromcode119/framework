// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiGet = vi.fn();
const apiPost = vi.fn();
const canManagePlatform = vi.fn();

vi.mock('@/lib/api', () => ({
  AdminApi: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
  },
}));
vi.mock('@/lib/tenants/platform-access', () => ({
  PlatformAccess: { canManagePlatform: () => canManagePlatform() },
}));

import type { ReactElement } from 'react';
import { WorkspaceConsoleExitBar } from '@/app/components/view/workspace-console-exit-bar.client';
import { AdminRuntimeContext } from '@/components/view/admin-runtime-context.client';
import { SessionAppearanceChoice } from '@/lib/appearance/session-appearance-choice';
import { AdminConstants } from '@/lib/constants/admin.constants';

const notify = vi.fn();
const mount = (ui: ReactElement) =>
  render(
    <AdminRuntimeContext.context.Provider value={{ auth: { user: { email: 'ops@example.test', roles: ['admin'] } }, notify: { addNotification: vi.fn(), notify }, globalSettings: {}, collections: [], plugins: { collections: [] } } as any}>
      {ui}
    </AdminRuntimeContext.context.Provider>,
  );

const available = {
  multiTenant: true,
  current: 'ws-1',
  mode: 'appearance',
  tenants: [{ id: 'ws-1', slug: 'fromcode-hub', kind: 'workspace', appearance: 'hub', primaryHost: 'hub.example.test' }],
};

/**
 * A platform admin who opens a workspace as its own console must always have a way back — whatever
 * the appearance's chrome draws — and the bar must not appear where there is nothing to leave.
 */
describe('WorkspaceConsoleExitBar', () => {
  const reload = vi.fn();

  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    notify.mockReset();
    reload.mockReset();
    canManagePlatform.mockReset().mockReturnValue(true);
    Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload } });
  });

  afterEach(() => SessionAppearanceChoice.clear());

  it('offers configure and platform in a workspace opened as its appearance', async () => {
    SessionAppearanceChoice.set('hub');
    apiGet.mockResolvedValue(available);
    mount(<WorkspaceConsoleExitBar />);

    expect(await screen.findByText(/fromcode-hub/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /configure in the standard console/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /back to platform/i })).toBeTruthy();
  });

  it('steps out to the platform and reloads', async () => {
    SessionAppearanceChoice.set('hub');
    apiGet.mockResolvedValue(available);
    apiPost.mockResolvedValue({ ok: true });
    mount(<WorkspaceConsoleExitBar />);

    fireEvent.click(await screen.findByRole('button', { name: /back to platform/i }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(apiPost).toHaveBeenCalledWith(AdminConstants.ENDPOINTS.AUTH.TENANTS_LEAVE, {});
  });

  it('reopens the same workspace in the standard console', async () => {
    SessionAppearanceChoice.set('hub');
    apiGet.mockResolvedValue(available);
    apiPost.mockResolvedValue({ ok: true });
    mount(<WorkspaceConsoleExitBar />);

    fireEvent.click(await screen.findByRole('button', { name: /configure in the standard console/i }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(apiPost).toHaveBeenCalledWith(AdminConstants.ENDPOINTS.AUTH.TENANTS_SELECT, { tenantId: 'ws-1', mode: 'configure' });
  });

  it('says why when a switch is refused instead of reloading', async () => {
    SessionAppearanceChoice.set('hub');
    apiGet.mockResolvedValue(available);
    apiPost.mockRejectedValue({ code: 'tenant_access_denied' });
    mount(<WorkspaceConsoleExitBar />);

    fireEvent.click(await screen.findByRole('button', { name: /configure in the standard console/i }));
    await waitFor(() => expect(notify).toHaveBeenCalled());
    expect(reload).not.toHaveBeenCalled();
  });

  it('offers no platform exit to an account that cannot act on the platform', async () => {
    SessionAppearanceChoice.set('hub');
    canManagePlatform.mockReturnValue(false);
    apiGet.mockResolvedValue(available);
    mount(<WorkspaceConsoleExitBar />);

    expect(await screen.findByRole('button', { name: /configure in the standard console/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /back to platform/i })).toBeNull();
  });

  it('renders nothing outside that session choice', async () => {
    SessionAppearanceChoice.set('default');
    apiGet.mockResolvedValue(available);
    const { container } = mount(<WorkspaceConsoleExitBar />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.textContent).toBe('');
    expect(apiGet).not.toHaveBeenCalled();
  });
});
