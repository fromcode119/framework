// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BackupsPageClient } from '@/components/settings/backups/view/backups-page-client.client';

/**
 * A system backup contains every site on the platform, and a restore overwrites all of them — so the
 * screen belongs to the platform, and a site administrator must be told that rather than shown a form
 * whose every button the API refuses.
 */
vi.mock('@/components/view/use-theme.client', () => ({ ThemeHooks: { useTheme: () => ({ theme: 'light' }) } }));
vi.mock('@/components/view/use-auth.client', () => ({
  AuthHooks: { useAuth: () => ({ user: { email: 'site.admin@example.test', platformAdmin: false, multiTenant: true } }) },
}));
// Reached only if the gate FAILS; its presence here is what makes that failure visible.
vi.mock('@/components/settings/backups/view/backups-page-controller.client', () => ({
  BackupsPageControllerHooks: { useController: () => ({}) },
}));
vi.mock('@/components/settings/backups/view/backups-page-client-view.client', () => ({
  BackupsPageClientView: () => <div>backups-form</div>,
}));

describe('BackupsPageClient', () => {
  it('tells a site administrator this is a platform screen instead of rendering the backup form', () => {
    render(<BackupsPageClient />);

    expect(screen.getByText(/This is a platform screen/i)).toBeTruthy();
    expect(screen.queryByText('backups-form')).toBeNull();
  });
});
