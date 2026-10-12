// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGet = vi.fn();

vi.mock('@/lib/api', () => ({
  AdminApi: {
    get: (...args: unknown[]) => apiGet(...args),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

import type { ReactElement } from 'react';
import { SecuritySettingsPage } from '@/app/settings/security/page.client';
import { AdminRuntimeContext } from '@/components/view/admin-runtime-context.client';
import { AdminConstants } from '@/lib/constants/admin.constants';

const STORED_SETTINGS = { rate_limit_max: '250', password_min_length: '12' };
const STATS = { monitor: { violations24h: 0 } };

const withRuntime = (ui: ReactElement) =>
  render(
    <AdminRuntimeContext.context.Provider
      value={{
        plugins: { collections: [] },
        notify: { addNotification: vi.fn(), notify: vi.fn() },
        globalSettings: {},
        collections: [],
        // The Dashboard tab is only offered to an operator who can manage the platform.
        auth: { user: { email: 'platform@example.test', platformAdmin: true, multiTenant: true } },
      } as any}
    >
      {ui}
    </AdminRuntimeContext.context.Provider>
  );

/** Each tab switch reloads the page data; a test can hold the stats request open to race a click against it. */
function routeRequests(statsResponse: () => Promise<unknown>): void {
  apiGet.mockImplementation((url: string) => {
    if (url === AdminConstants.ENDPOINTS.SYSTEM.STATS.SECURITY) return statsResponse();
    if (url === AdminConstants.ENDPOINTS.SYSTEM.SETTINGS) return Promise.resolve(STORED_SETTINGS);
    if (url === AdminConstants.ENDPOINTS.SYSTEM.SETTINGS_PLATFORM_KEYS) return Promise.resolve({ keys: [] });
    return Promise.reject(new Error(`unexpected request ${url}`));
  });
}

const headerTab = (label: string): HTMLElement => screen.getByRole('button', { name: label });
const settingsViewShown = (): boolean => screen.queryByText('Update Security') !== null && screen.queryByText('Password Policy') !== null;
const dashboardViewShown = (): boolean => screen.queryByText('Threat Alerts') !== null;

describe('Security page: the header tabs switch the view on ONE click', () => {
  beforeEach(() => {
    apiGet.mockReset();
  });

  it('opens Settings and returns to Dashboard with a single click each', async () => {
    routeRequests(() => Promise.resolve(STATS));
    withRuntime(<SecuritySettingsPage />);
    await waitFor(() => expect(dashboardViewShown()).toBe(true));

    fireEvent.click(headerTab('Settings'));
    expect(settingsViewShown()).toBe(true);
    expect(dashboardViewShown()).toBe(false);

    fireEvent.click(headerTab('Dashboard'));
    await waitFor(() => expect(dashboardViewShown()).toBe(true));
    expect(settingsViewShown()).toBe(false);
  });

  it('opens Settings at once while a Dashboard reload is still in flight, and a late reply does not switch it back', async () => {
    let releaseStats: (value: unknown) => void = () => {};
    routeRequests(() => Promise.resolve(STATS));
    withRuntime(<SecuritySettingsPage />);
    await waitFor(() => expect(dashboardViewShown()).toBe(true));

    // Settings → Dashboard, with the Dashboard's stats request held open.
    fireEvent.click(headerTab('Settings'));
    routeRequests(() => new Promise((resolve) => { releaseStats = resolve; }));
    fireEvent.click(headerTab('Dashboard'));
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith(AdminConstants.ENDPOINTS.SYSTEM.STATS.SECURITY));

    // One click, mid-reload.
    fireEvent.click(headerTab('Settings'));
    expect(settingsViewShown()).toBe(true);

    await act(async () => { releaseStats(STATS); });
    expect(settingsViewShown()).toBe(true);
    expect(dashboardViewShown()).toBe(false);
  });
});
