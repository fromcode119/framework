import { describe, expect, it, vi } from 'vitest';
import { AdminConstants } from '@/lib/constants';

const redirectMock = vi.fn((path: string) => {
  throw new Error(`redirect:${path}`);
});

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}));

import SettingsPage from './page';

describe('SettingsPage', () => {
  it('redirects /settings to /settings/general', () => {
    expect(() => SettingsPage()).toThrow(`redirect:${AdminConstants.ROUTES.SETTINGS.GENERAL}`);
    expect(redirectMock).toHaveBeenCalledWith(AdminConstants.ROUTES.SETTINGS.GENERAL);
  });
});