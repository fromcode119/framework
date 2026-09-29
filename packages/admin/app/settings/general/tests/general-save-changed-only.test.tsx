// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGet = vi.fn();
const settingsGetAll = vi.fn();
const settingsUpdate = vi.fn();
const addNotification = vi.fn();

vi.mock('@/lib/api', () => ({
  AdminApi: { get: (...args: unknown[]) => apiGet(...args), put: vi.fn(), post: vi.fn() },
}));

vi.mock('@/lib/settings/admin-system-settings-client', () => ({
  AdminSystemSettingsClient: {
    getAll: (...args: unknown[]) => settingsGetAll(...args),
    update: (...args: unknown[]) => settingsUpdate(...args),
  },
}));

import type { ReactElement } from 'react';
import { GeneralSettingsPage } from '@/app/settings/general/page.client';
import { AdminRuntimeContext } from '@/components/view/admin-runtime-context.client';

const withRuntime = (ui: ReactElement) =>
  render(
    <AdminRuntimeContext.context.Provider
      value={{
        plugins: { collections: [] },
        notify: { addNotification, notify: vi.fn() },
        globalSettings: {},
        collections: [],
        auth: { user: { email: 'platform@example.test', platformAdmin: true, multiTenant: true } },
      } as any}
    >
      {ui}
    </AdminRuntimeContext.context.Provider>
  );

/**
 * A site that never set a key reads it back blank. Saving used to PUT every key on the screen, which
 * stored those blanks as the site's own values — and a site row, even an empty one, hides the
 * platform's value from that site. Only what the operator actually changed may be sent.
 */
describe('General settings: Save sends only what changed', () => {
  beforeEach(() => {
    apiGet.mockReset();
    settingsGetAll.mockReset();
    settingsUpdate.mockReset();
    addNotification.mockReset();
    // No platform-key answer: nothing locked, every key shown and writable — the widest save there is.
    apiGet.mockRejectedValue(new Error('no platform keys'));
    settingsGetAll.mockResolvedValue({ platform_name: 'Shop', timezone: 'Europe/Sofia' });
    settingsUpdate.mockResolvedValue({});
  });

  it('sends nothing when nothing was changed, so no blank row is ever written', async () => {
    withRuntime(<GeneralSettingsPage />);
    await waitFor(() => expect(screen.getByDisplayValue('Shop')).not.toBeNull());

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(addNotification).toHaveBeenCalledWith(expect.objectContaining({ title: 'Settings Saved' })));
    expect(settingsUpdate).not.toHaveBeenCalled();
  });

  it('sends exactly the one field the operator edited', async () => {
    withRuntime(<GeneralSettingsPage />);
    await waitFor(() => expect(screen.getByDisplayValue('Shop')).not.toBeNull());

    fireEvent.change(screen.getByDisplayValue('Shop'), { target: { value: 'Shop & Co' } });
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(settingsUpdate).toHaveBeenCalledTimes(1));
    expect(settingsUpdate).toHaveBeenCalledWith({ platform_name: 'Shop & Co' });
  });
});
