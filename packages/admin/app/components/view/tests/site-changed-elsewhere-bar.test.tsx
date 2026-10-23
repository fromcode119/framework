// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGet = vi.fn();
const apiPost = vi.fn();

vi.mock('@/lib/api', () => ({
  AdminApi: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
  },
}));

import type { ReactElement } from 'react';
import { SiteChangedElsewhereBar } from '@/app/components/view/site-changed-elsewhere-bar.client';
import { AdminRuntimeContext } from '@/components/view/admin-runtime-context.client';
import { AdminConstants } from '@/lib/constants/admin.constants';

const mount = (ui: ReactElement) =>
  render(
    <AdminRuntimeContext.context.Provider value={{ auth: { user: { email: 'ops@example.test', roles: ['admin'] } }, notify: { addNotification: vi.fn(), notify: vi.fn() }, globalSettings: {}, collections: [], plugins: { collections: [] } } as any}>
      {ui}
    </AdminRuntimeContext.context.Provider>,
  );

const tenants = [
  { id: 'site-a', slug: 'site-a', kind: 'workspace', primaryHost: 'a.example.test' },
  { id: 'site-b', slug: 'site-b', kind: 'site', primaryHost: 'b.example.test' },
];
const answer = (current: string | null, mode: string | null) => ({ multiTenant: true, current, mode, tenants });

/** Another tab switching the shared session must be said out loud in this one, with a way back. */
describe('SiteChangedElsewhereBar', () => {
  const reload = vi.fn();

  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    reload.mockReset();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload } });
  });

  const comeBack = async () => {
    await act(async () => { window.dispatchEvent(new Event('focus')); });
  };

  it('stays hidden while the session is still where the page opened', async () => {
    apiGet.mockResolvedValue(answer('site-a', 'appearance'));
    mount(<SiteChangedElsewhereBar />);
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1));
    await comeBack();
    expect(apiGet).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('names both sites when another tab switched, and goes back with the same console', async () => {
    apiGet.mockResolvedValueOnce(answer('site-a', 'appearance')).mockResolvedValue(answer('site-b', null));
    apiPost.mockResolvedValue({ ok: true });
    mount(<SiteChangedElsewhereBar />);
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1));
    await comeBack();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('moved this console to site-b');
    expect(alert.textContent).toContain('opened for site-a (its own console)');

    fireEvent.click(screen.getByRole('button', { name: /back to site-a/i }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(apiPost).toHaveBeenCalledWith(AdminConstants.ENDPOINTS.AUTH.TENANTS_SELECT, { tenantId: 'site-a', mode: 'appearance' });
  });

  it('notices the same site reopened in the other console', async () => {
    apiGet.mockResolvedValueOnce(answer('site-a', 'appearance')).mockResolvedValue(answer('site-a', 'configure'));
    mount(<SiteChangedElsewhereBar />);
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1));
    await comeBack();
    expect((await screen.findByRole('alert')).textContent).toContain('site-a (standard console)');
  });

  it('continues on the new site by reloading, and leaves to the platform when that is where it opened', async () => {
    apiGet.mockResolvedValueOnce(answer(null, null)).mockResolvedValue(answer('site-b', null));
    apiPost.mockResolvedValue({ ok: true });
    mount(<SiteChangedElsewhereBar />);
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1));
    await comeBack();

    fireEvent.click(await screen.findByRole('button', { name: /continue on site-b/i }));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(apiPost).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /back to platform/i }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith(AdminConstants.ENDPOINTS.AUTH.TENANTS_LEAVE, {}));
  });

  it('does nothing on a single-site deployment', async () => {
    apiGet.mockResolvedValue({ multiTenant: false, current: null, mode: null, tenants: [] });
    mount(<SiteChangedElsewhereBar />);
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1));
    await comeBack();
    expect(apiGet).toHaveBeenCalledTimes(1);
  });
});
