import { FrameworkIcons } from '@fromcode119/react';
import { CommandPalette } from '@/components/ui/view/command-palette.client';
import { NotificationPanel } from '@/app/components/view/notification-panel.client';
import { SidebarAccountCard } from '@/app/components/view/sidebar-account-card.client';
import { SidebarBrandHeader } from '@/app/sidebar-brand-header';
import { NavItemView } from '@/app/components/view/sidebar-nav-item-view.client';
import { SidebarNavBack } from '@/app/components/view/sidebar-nav-back.client';
import { SidebarSearch } from '@/app/sidebar-search.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { KitPlay } from '@/app/kit/view/kit-play.client';
import type { KitDoc } from '@/app/kit/kit-doc';

/** The console's own frame: the menu, its search, the big search and the notifications. */
export class ShellKit {
  private static nothing(): void { /* a sample has nothing to do */ }

  static docs(): KitDoc[] {
    const pages = ['Dashboard', 'Orders', 'Products', 'Customers', 'Settings'];
    return [
      {
        slug: 'menu', name: 'Menu', group: 'Navigation',
        intro: 'The console’s side menu, built from the same pieces the real one renders: its head, its rows, the way back out of Settings, and the account at its foot.',
        from: 'The menu is the console’s own; a plugin adds rows through its manifest, not by rendering these.',
        examples: [
          { title: 'Head, rows and the account', text: 'The head holds the site, the control that folds the menu and the notifications. The open page’s row is raised.', demo: <div className="fc-nav fc-kit__nav fc-kit__nav--menu"><SidebarBrandHeader isMini={false} platformName="Console" onClose={ShellKit.nothing} onCollapse={ShellKit.nothing} /><div className="fc-nav-list fc-kit__nav-rows"><NavItemView label="Dashboard" href="/kit" icon={<FrameworkIcons.Dashboard size={16} />} active rawPathname="/kit" /><NavItemView label="Media" href="/media" icon={<FrameworkIcons.Image size={16} />} rawPathname="/kit" /><NavItemView label="Settings" href="/settings/general" icon={<FrameworkIcons.Settings size={16} />} rawPathname="/kit" /></div><SidebarAccountCard /></div> },
          { title: 'A section with pages under it', text: 'A section’s pages hang under its row, one level only. A page that needs more than that opens its own parts as tabs on the page — the menu never goes three deep.', demo: <div className="fc-nav fc-kit__nav fc-kit__nav--menu"><div className="fc-nav-list fc-kit__nav-rows"><NavItemView label="Commerce" href="/kit/menu" icon={<FrameworkIcons.Plugins size={16} />} active rawPathname="/kit/menu" subItems={[{ label: 'Orders', path: '/kit/menu' }, { label: 'Products', path: '/kit/products' }, { label: 'Customers', path: '/kit/customers' }]} /><NavItemView label="Media" href="/media" icon={<FrameworkIcons.Image size={16} />} rawPathname="/kit/menu" /></div></div> },
          { title: 'Inside Settings', text: 'Settings is a place of its own: the way back first, then its pages.', demo: <div className="fc-nav fc-kit__nav fc-kit__nav--menu"><div className="fc-kit__nav-rows"><SidebarNavBack href="/kit" label="Settings" /><div className="fc-nav-list"><NavItemView label="Users" href="/users" icon={<FrameworkIcons.Settings size={16} />} rawPathname="/kit" /><NavItemView label="Plugins" href="/kit" icon={<FrameworkIcons.Plugins size={16} />} active rawPathname="/kit" /><NavItemView label="General" href="/settings/general" icon={<FrameworkIcons.Settings size={16} />} rawPathname="/kit" /></div></div></div> },
        ],
        options: [
          { name: 'NavItemView label, href, icon', type: 'string, string, ReactNode', does: 'One row.' },
          { name: 'active', type: 'boolean', does: 'The open page’s row.' },
          { name: 'subItems', type: '{ label, path }[]', does: 'The pages under a section.' },
          { name: 'SidebarNavBack href, label', type: 'string', does: 'The way out of a place with its own menu.' },
        ],
      },
      {
        slug: 'search', name: 'Menu search and CommandPalette', group: 'Navigation',
        intro: 'Two searches. The one in the menu narrows the menu’s rows as it is typed. ⌘K opens the big one over the page, which finds a page from anywhere.',
        from: "import { CommandPalette } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'In the menu', demo: <div className="fc-nav fc-kit__nav"><KitPlay initial="">{(value, set) => <SidebarSearch query={value} onQuery={set} onPalette={ShellKit.nothing} listens={false} />}</KitPlay></div> },
          { title: 'The big search', text: 'Arrow keys move, Enter opens, Esc closes.', demo: <KitPlay initial={null}>{(value, set) => (<><Button variant={ButtonVariant.SECONDARY} onClick={() => set('')}>Open the big search</Button><CommandPalette open={value !== null} onClose={() => set(null)} query={value || ''} onQuery={set} placeholder="Search" empty="Nothing matches" items={pages.filter((name) => name.toLowerCase().includes(String(value || '').toLowerCase())).map((name) => ({ id: name, label: name, hint: name === 'Orders' || name === 'Products' ? 'Commerce' : undefined, onSelect: () => set(null) }))} /></>)}</KitPlay>, code: "<CommandPalette open={open} onClose={close} query={query} onQuery={setQuery}\n  placeholder=\"Search\" empty=\"Nothing matches\"\n  items={[{ id: 'orders', label: 'Orders', hint: 'Commerce', onSelect: () => go('/orders') }]} />" },
        ],
        options: [
          { name: 'open, onClose', type: 'boolean, () => void', does: 'Whether it shows.' },
          { name: 'query, onQuery', type: 'string, (text) => void', does: 'What is typed.' },
          { name: 'items', type: '{ id, label, icon?, hint?, onSelect }[]', does: 'What matches; `hint` is a quiet word at the row’s end.' },
          { name: 'placeholder, empty', type: 'string, ReactNode', does: 'The field’s words; what it says with no match.' },
        ],
      },
      {
        slug: 'notifications', name: 'NotificationPanel', group: 'Feedback',
        intro: 'What the bell opens: what happened while nobody looked, unread first.',
        from: 'Part of the console’s frame; a plugin sends a notification, it does not render the panel.',
        examples: [
          { title: 'With notifications', flush: true, demo: <div className="fc-surface"><NotificationPanel deviceOn={false} onToggle={ShellKit.nothing} onFollow={ShellKit.nothing} onToggleDevice={ShellKit.nothing} notifications={[{ id: '1', title: 'A plugin is waiting for approval', body: 'It was installed and is held until someone turns it on.', createdAt: new Date().toISOString(), source: 'system', read: false, link: '/plugins' }, { id: '2', title: 'Backup finished', body: 'The nightly archive was written.', createdAt: new Date().toISOString(), source: 'system', read: true }]} /></div> },
          { title: 'Empty', flush: true, demo: <div className="fc-surface"><NotificationPanel deviceOn={false} onToggle={ShellKit.nothing} onFollow={ShellKit.nothing} onToggleDevice={ShellKit.nothing} notifications={[]} /></div> },
        ],
        options: [],
      },
    ];
  }
}
