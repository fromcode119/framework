import { KitCopy } from '@/app/kit/kit-copy';
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
        slug: 'menu', name: 'Menu', group: KitCopy.t('docs.shell.navigation'),
        intro: KitCopy.t('docs.shell.theConsoleSSideMenu'),
        from: 'The menu is the console’s own; a plugin adds rows through its manifest, not by rendering these.',
        examples: [
          { title: KitCopy.t('docs.shell.headRowsAndTheAccount'), text: KitCopy.t('docs.shell.theHeadHoldsTheSite'), demo: <div className="fc-nav fc-kit__nav fc-kit__nav--menu"><SidebarBrandHeader isMini={false} platformName="Console" onClose={ShellKit.nothing} onCollapse={ShellKit.nothing} /><div className="fc-nav-list fc-kit__nav-rows"><NavItemView label={KitCopy.t('docs.shell.dashboard')} href="/kit" icon={<FrameworkIcons.Dashboard size={16} />} active rawPathname="/kit" /><NavItemView label={KitCopy.t('docs.shell.media')} href="/media" icon={<FrameworkIcons.Image size={16} />} rawPathname="/kit" /><NavItemView label={KitCopy.t('docs.shell.settings')} href="/settings/general" icon={<FrameworkIcons.Settings size={16} />} rawPathname="/kit" /></div><SidebarAccountCard /></div> },
          { title: KitCopy.t('docs.shell.aSectionWithPagesUnder'), text: KitCopy.t('docs.shell.aSectionSPagesHang'), demo: <div className="fc-nav fc-kit__nav fc-kit__nav--menu"><div className="fc-nav-list fc-kit__nav-rows"><NavItemView label={KitCopy.t('docs.shell.commerce')} href="/kit/menu" icon={<FrameworkIcons.Plugins size={16} />} active rawPathname="/kit/menu" subItems={[{ label: KitCopy.t('docs.shell.orders'), path: '/kit/menu' }, { label: KitCopy.t('docs.shell.products'), path: '/kit/products' }, { label: KitCopy.t('docs.shell.customers'), path: '/kit/customers' }]} /><NavItemView label={KitCopy.t('docs.shell.media')} href="/media" icon={<FrameworkIcons.Image size={16} />} rawPathname="/kit/menu" /></div></div> },
          { title: KitCopy.t('docs.shell.insideSettings'), text: KitCopy.t('docs.shell.settingsIsAPlaceOf'), demo: <div className="fc-nav fc-kit__nav fc-kit__nav--menu"><div className="fc-kit__nav-rows"><SidebarNavBack href="/kit" label={KitCopy.t('docs.shell.settings')} /><div className="fc-nav-list"><NavItemView label={KitCopy.t('docs.shell.users')} href="/users" icon={<FrameworkIcons.Settings size={16} />} rawPathname="/kit" /><NavItemView label={KitCopy.t('docs.shell.plugins')} href="/kit" icon={<FrameworkIcons.Plugins size={16} />} active rawPathname="/kit" /><NavItemView label={KitCopy.t('docs.shell.general')} href="/settings/general" icon={<FrameworkIcons.Settings size={16} />} rawPathname="/kit" /></div></div></div> },
        ],
        options: [
          { name: 'NavItemView label, href, icon', type: 'string, string, ReactNode', does: KitCopy.t('docs.shell.oneRow') },
          { name: 'active', type: 'boolean', does: KitCopy.t('docs.shell.theOpenPageSRow') },
          { name: 'subItems', type: '{ label, path }[]', does: KitCopy.t('docs.shell.thePagesUnderASection') },
          { name: 'SidebarNavBack href, label', type: 'string', does: KitCopy.t('docs.shell.theWayOutOfA') },
        ],
      },
      {
        slug: 'search', name: 'Menu search and CommandPalette', group: KitCopy.t('docs.shell.navigation'),
        intro: KitCopy.t('docs.shell.twoSearchesTheOneIn'),
        from: "import { CommandPalette } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.shell.inTheMenu'), demo: <div className="fc-nav fc-kit__nav"><KitPlay initial="">{(value, set) => <SidebarSearch query={value} onQuery={set} onPalette={ShellKit.nothing} listens={false} />}</KitPlay></div> },
          { title: KitCopy.t('docs.shell.theBigSearch'), text: KitCopy.t('docs.shell.arrowKeysMoveEnterOpens'), demo: <KitPlay initial={null}>{(value, set) => (<><Button variant={ButtonVariant.SECONDARY} onClick={() => set('')}>{KitCopy.t('docs.shell.openTheBigSearch')}</Button><CommandPalette open={value !== null} onClose={() => set(null)} query={value || ''} onQuery={set} placeholder={KitCopy.t('docs.shell.search')} empty="Nothing matches" items={pages.filter((name) => name.toLowerCase().includes(String(value || '').toLowerCase())).map((name) => ({ id: name, label: name, hint: name === 'Orders' || name === 'Products' ? 'Commerce' : undefined, onSelect: () => set(null) }))} /></>)}</KitPlay>, code: "<CommandPalette open={open} onClose={close} query={query} onQuery={setQuery}\n  placeholder=\"Search\" empty=\"Nothing matches\"\n  items={[{ id: 'orders', label: 'Orders', hint: 'Commerce', onSelect: () => go('/orders') }]} />" },
        ],
        options: [
          { name: 'open, onClose', type: 'boolean, () => void', does: KitCopy.t('docs.shell.whetherItShows') },
          { name: 'query, onQuery', type: 'string, (text) => void', does: KitCopy.t('docs.shell.whatIsTyped') },
          { name: 'items', type: '{ id, label, icon?, hint?, onSelect }[]', does: KitCopy.t('docs.shell.whatMatchesHintIsA') },
          { name: 'placeholder, empty', type: 'string, ReactNode', does: KitCopy.t('docs.shell.theFieldSWordsWhat') },
        ],
      },
      {
        slug: 'notifications', name: 'NotificationPanel', group: KitCopy.t('docs.shell.feedback'),
        intro: KitCopy.t('docs.shell.whatTheBellOpensWhat'),
        from: 'Part of the console’s frame; a plugin sends a notification, it does not render the panel.',
        examples: [
          { title: KitCopy.t('docs.shell.withNotifications'), flush: true, demo: <div className="fc-surface"><NotificationPanel deviceOn={false} onToggle={ShellKit.nothing} onFollow={ShellKit.nothing} onToggleDevice={ShellKit.nothing} notifications={[{ id: '1', title: KitCopy.t('docs.shell.aPluginIsWaitingFor'), body: 'It was installed and is held until someone turns it on.', createdAt: new Date().toISOString(), source: 'system', read: false, link: '/plugins' }, { id: '2', title: KitCopy.t('docs.shell.backupFinished'), body: 'The nightly archive was written.', createdAt: new Date().toISOString(), source: 'system', read: true }]} /></div> },
          { title: KitCopy.t('docs.shell.empty'), flush: true, demo: <div className="fc-surface"><NotificationPanel deviceOn={false} onToggle={ShellKit.nothing} onFollow={ShellKit.nothing} onToggleDevice={ShellKit.nothing} notifications={[]} /></div> },
        ],
        options: [],
      },
    ];
  }
}
