// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGet = vi.fn();
const apiPut = vi.fn();
const settingsGetAll = vi.fn();
const settingsUpdate = vi.fn();

vi.mock('@/lib/api', () => ({
  AdminApi: {
    get: (...args: unknown[]) => apiGet(...args),
    put: (...args: unknown[]) => apiPut(...args),
    post: vi.fn(),
  },
}));

vi.mock('@/lib/settings/admin-system-settings-client', () => ({
  AdminSystemSettingsClient: {
    getAll: (...args: unknown[]) => settingsGetAll(...args),
    update: (...args: unknown[]) => settingsUpdate(...args),
  },
}));

import type { ReactElement } from 'react';
import { GeneralSettingsPage } from '@/app/settings/general/page.client';
import { RoutingPage } from '@/app/settings/routing/page.client';
import { SecuritySettingsPage } from '@/app/settings/security/page.client';
import { AdminRuntimeContext } from '@/components/view/admin-runtime-context.client';

/**
 * Settings pages are `AdminComponent`s and only ever mount inside `AdminRuntimeProvider` (ClientLayout).
 * Rendering them bare left `this.context` at the context's `null` default, which `this.runtime` now
 * rejects outright instead of handing back null for a caller to trip over. Mount them the way the app
 * does. The runtime is deliberately EMPTY of settings data — these tests assert that a failed load
 * shows an error and renders no seeded values, so the fixture must not supply any.
 */
const withRuntime = (ui: ReactElement) =>
  render(
    <AdminRuntimeContext.context.Provider
      value={{ plugins: { collections: [] }, notify: { addNotification: vi.fn(), notify: vi.fn() }, globalSettings: {}, collections: [] } as any}
    >
      {ui}
    </AdminRuntimeContext.context.Provider>
  );

/**
 * A settings screen whose load fails must SAY SO. It must not fall back to values seeded in code —
 * the operator cannot tell those from saved configuration, and pressing Save then writes the
 * invented values over the real ones. Every one of these numbers is also DECLARED and seeded
 * server-side (`packages/api/src/server/server-settings-service.ts`), so a code-side copy is a
 * second, invisible default with no purpose beyond this failure mode.
 */
describe('settings pages: a failed load is visible and blocks Save', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPut.mockReset();
    settingsGetAll.mockReset();
    settingsUpdate.mockReset();
  });

  describe('Security', () => {
    it('shows the failure and renders none of the seeded rate-limit values', async () => {
      apiGet.mockRejectedValue(new Error('Network request failed'));

      const { container } = withRuntime(<SecuritySettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Security settings could not be loaded')).not.toBeNull();
      });
      expect(screen.getByText('Network request failed')).not.toBeNull();

      const body = container.textContent || '';
      expect(body).not.toContain('100');
      expect(body).not.toContain('900000');
      expect(body).not.toContain('10080');
    });

    it('does not render the Update Security control on the Settings tab after a failed load', async () => {
      apiGet.mockRejectedValue(new Error('Network request failed'));

      withRuntime(<SecuritySettingsPage />);
      await waitFor(() => {
        expect(screen.getByText('Security settings could not be loaded')).not.toBeNull();
      });

      fireEvent.click(screen.getByText('Settings'));
      // The tab switch re-runs the load, which fails again — let React settle before asserting.
      await waitFor(() => {
        expect(screen.getByText('Security settings could not be loaded')).not.toBeNull();
      });

      expect(screen.queryByText('Update Security')).toBeNull();
      expect(apiPut).not.toHaveBeenCalled();
    });

    it('renders the Save control once a load has actually succeeded', async () => {
      apiGet.mockResolvedValue({
        two_factor_enabled: 'false',
        rate_limit_max: '250',
        rate_limit_max_authenticated: '5000',
        rate_limit_window: '900000',
        auth_session_duration_minutes: '10080',
      });

      withRuntime(<SecuritySettingsPage />);
      await waitFor(() => {
        expect(screen.queryByText('Security settings could not be loaded')).toBeNull();
      });

      fireEvent.click(screen.getByText('Settings'));
      await waitFor(() => {
        expect(screen.getByText('Update Security')).not.toBeNull();
      });
    });
  });

  describe('General', () => {
    it('shows the failure and never claims frontend registration is enabled', async () => {
      settingsGetAll.mockRejectedValue(new Error('502: Bad gateway'));

      const { container } = withRuntime(<GeneralSettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('General settings could not be loaded')).not.toBeNull();
      });
      expect(screen.getByText('502: Bad gateway')).not.toBeNull();
      // The whole form — including the auth/registration toggles and the UTC timezone seed — stays out.
      expect(screen.queryByText('Save Changes')).toBeNull();
      expect(container.textContent || '').not.toContain('UTC');
      expect(settingsUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Routing', () => {
    it('shows the failure and renders neither seeded routing value', async () => {
      settingsGetAll.mockRejectedValue(new Error('Network request failed'));
      apiGet.mockRejectedValue(new Error('Network request failed'));

      const { container } = withRuntime(<RoutingPage />);

      await waitFor(() => {
        expect(screen.getByText('Routing settings could not be loaded')).not.toBeNull();
      });

      const body = container.textContent || '';
      expect(body).not.toContain('/:slug');
      expect(body).not.toContain('Auto detect');
      expect(screen.queryByText('Apply Routing')).toBeNull();
      expect(settingsUpdate).not.toHaveBeenCalled();
    });
  });
});
