import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from '@/app/components/view/sidebar.client';
import { AdminRuntimeContext } from '@/components/view/admin-runtime-context.client';

const mockUsePlugins = vi.fn();
const mockUseAuth = vi.fn();
const mockUsePathname = vi.fn();

const renderSidebar = () =>
  render(
    <AdminRuntimeContext.context.Provider
      value={{ plugins: mockUsePlugins(), auth: mockUseAuth(), pathname: mockUsePathname() } as any}
    >
      <Sidebar isOpen onMiniToggle={() => undefined} />
    </AdminRuntimeContext.context.Provider>
  );

vi.mock('@fromcode119/react', () => ({
  ContextHooks: {
    usePlugins: () => mockUsePlugins(),
  },
  Slot: () => null,
  // The notifications menu asks the browser about push; jsdom has none, which is what this reports.
  PushDevice: class { static supported = false; static blocked = false; async isOn() { return false; } },
  // Every icon, not a hand-listed five. The list version broke the moment a component reached for an
  // icon nobody had added here — React renders `undefined` as "Element type is invalid", which names
  // the COMPONENT and not the missing icon, so the failure reads like a bug in the thing under test.
  // A proxy means this mock never needs updating again.
  FrameworkIcons: new Proxy({}, {
    get: (_target, name: string) => () => <span>{String(name)}</span>,
  }),
}));

vi.mock('@/components/view/use-theme.client', () => ({
  ThemeHooks: {
    useTheme: () => ({ theme: 'light' }),
  },
}));

vi.mock('@/components/view/use-auth.client', () => ({
  AuthHooks: {
    useAuth: () => mockUseAuth(),
  },
}));

vi.mock('@/components/view/icon.client', () => ({
  Icon: ({ name }: { name: string }) => <span data-icon={name} />, 
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
      uiPreference: {},
    }),
  },
}));

vi.mock('@/app/components/view/secondary-sidebar-panel-body.client', () => ({
  default: () => null,
}));

describe('Sidebar', () => {
  beforeEach(() => {
    // An open section brings itself into view; jsdom lays nothing out and has no such method.
    Element.prototype.scrollIntoView = vi.fn();
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

    renderSidebar();

    expect(screen.getByText('Users')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();
    expect(screen.getAllByText('Settings')).toHaveLength(1);
  });

  it('lists the upkeep pages under Settings while you are in it, and keeps them out of the main column', () => {
    mockUseAuth.mockReturnValue({ user: { roles: ['admin'] } });

    const { container } = renderSidebar();

    const main = container.querySelector('.fc-nav-list')?.textContent || '';
    const foot = container.querySelector('.fc-nav-foot')?.textContent || '';
    expect(main).toContain('Dashboard');
    expect(main).not.toContain('Users');
    expect(foot).toContain('Users');
    expect(foot).toContain('Activity');
  });

  it('lists every upkeep page on its own line, not folded under the column group it came from', () => {
    mockUseAuth.mockReturnValue({ user: { roles: ['admin'] } });
    const { menuItems } = mockUsePlugins();
    mockUsePlugins.mockReturnValue({
      plugins: [],
      menuItems: [
        ...menuItems.map((item: any) => (item.path === '/settings'
          ? { ...item, children: [{ label: 'General', path: '/settings/general' }, { label: 'Security', path: '/settings/security' }] }
          : item)),
        { label: 'Jobs', path: '/jobs', pluginSlug: 'system', group: 'Platform', icon: 'Clock' },
      ],
    });

    const { container } = renderSidebar();

    expect(container.querySelector('.fc-nav-foot .fc-nav-sub__item--group')).toBeNull();
    const foot = container.querySelector('.fc-nav-foot')?.textContent || '';
    expect(foot).toContain('Users');
    expect(foot).toContain('Jobs');
    expect(foot).not.toContain('Platform');
  });

  it('does not fold the pages Settings itself brings under their column groups either', () => {
    mockUseAuth.mockReturnValue({ user: { roles: ['admin'] } });
    mockUsePlugins.mockReturnValue({
      plugins: [],
      menuItems: [
        { label: 'Dashboard', path: '/', pluginSlug: 'system', group: 'Core', icon: 'Dashboard' },
        {
          label: 'Settings', path: '/settings', pluginSlug: 'system', group: 'System', icon: 'Settings',
          children: [
            { label: 'Plugins', path: '/plugins', group: 'Management' },
            { label: 'Users', path: '/users', group: 'Platform' },
            { label: 'Jobs', path: '/jobs', group: 'Platform' },
            { label: 'Privacy', path: '/privacy', group: 'Платформа' },
            { label: 'Search', path: '/search', group: 'Платформа' },
          ],
        },
      ],
    });

    const { container } = renderSidebar();

    expect(container.querySelector('.fc-nav-foot .fc-nav-sub__item--group')).toBeNull();
    const foot = container.querySelector('.fc-nav-foot')?.textContent || '';
    expect(foot).toContain('Users');
    expect(foot).toContain('Privacy');
  });

  it('shows no page of Settings while you are elsewhere', () => {
    mockUseAuth.mockReturnValue({ user: { roles: ['admin'] } });
    mockUsePathname.mockReturnValue('/');

    const { container } = renderSidebar();

    expect(container.querySelector('.fc-nav-foot .fc-nav-sub')).toBeNull();
  });

  it('keeps users and settings hidden for non-admin users', () => {
    mockUseAuth.mockReturnValue({ user: { roles: ['editor'] } });

    renderSidebar();

    expect(screen.queryByText('Users')).toBeNull();
    expect(screen.queryByText('Settings')).toBeNull();
  });
});