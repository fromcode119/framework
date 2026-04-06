import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Sidebar from './sidebar';

const mockUsePlugins = vi.fn();
const mockUseAuth = vi.fn();
const mockUsePathname = vi.fn();

vi.mock('@fromcode119/react', () => ({
  ContextHooks: {
    usePlugins: () => mockUsePlugins(),
  },
  Slot: () => null,
}));

vi.mock('@/components/use-theme', () => ({
  ThemeHooks: {
    useTheme: () => ({ theme: 'light' }),
  },
}));

vi.mock('@/components/use-auth', () => ({
  AuthHooks: {
    useAuth: () => mockUseAuth(),
  },
}));

vi.mock('@/components/icon', () => ({
  Icon: ({ name }: { name: string }) => <span data-icon={name} />, 
}));

vi.mock('@/lib/icons', () => ({
  FrameworkIcons: {
    Close: () => <span>Close</span>,
    Zap: () => <span>Zap</span>,
    Down: () => <span>Down</span>,
    Left: () => <span>Left</span>,
    Activity: () => <span>ActivityIcon</span>,
  },
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock('@/lib/env', () => ({
  AppEnv: {
    APP_NAME: 'Fromcode',
  },
}));

vi.mock('@/lib/admin-services', () => ({
  AdminServices: {
    getInstance: () => ({
      uiPreference: {
        readCollapsedSidebarGroups: () => [],
        writeCollapsedSidebarGroups: () => undefined,
        readNavExpanded: () => null,
        writeNavExpanded: () => undefined,
      },
    }),
  },
}));

vi.mock('./secondary-sidebar-panel-body', () => ({
  default: () => null,
}));

describe('Sidebar', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/settings/security');
    mockUsePlugins.mockReturnValue({
      plugins: [],
      menuItems: [
        { label: 'Dashboard', path: '/', pluginSlug: 'system', group: 'Core', icon: 'Dashboard' },
        { label: 'Users', path: '/users', pluginSlug: 'system', group: 'Platform', icon: 'Users' },
        { label: 'Activity', path: '/activity', pluginSlug: 'system', group: 'Platform', icon: 'Activity' },
        { label: 'Settings', path: '/settings', pluginSlug: 'system', group: 'System', icon: 'Settings' },
      ],
    });
  });

  it('shows users and the single metadata-owned settings item for admins', () => {
    mockUseAuth.mockReturnValue({ user: { roles: ['admin'] } });

    render(<Sidebar isOpen onMiniToggle={() => undefined} />);

    expect(screen.getByText('Users')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();
    expect(screen.getAllByText('Settings')).toHaveLength(1);
  });

  it('keeps users and settings hidden for non-admin users', () => {
    mockUseAuth.mockReturnValue({ user: { roles: ['editor'] } });

    render(<Sidebar isOpen onMiniToggle={() => undefined} />);

    expect(screen.queryByText('Users')).toBeNull();
    expect(screen.queryByText('Settings')).toBeNull();
  });
});