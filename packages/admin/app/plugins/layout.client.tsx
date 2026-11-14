import type { ReactNode } from 'react';
import { AdminLink } from '@/components/view/admin-link.client';
import { prop, state } from '@fromcode119/react-class-components';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { AdminClass } from '@/lib/admin-class';
import { PlatformAccess } from '@/lib/tenants/platform-access';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { PlatformSettingLocks } from '@/lib/settings/platform-setting-locks';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class PluginsLayout extends AdminComponent {
  @prop declare children: ReactNode;
  /** Where the operator stands: Health and Marketplace are the platform's, not offered inside a site. */
  @state private siteScope = true;

  async componentDidMount(): Promise<void> {
    this.siteScope = (await PlatformSettingLocks.load()).isSiteScope();
  }

  /**
   * Health and Marketplace describe the PLATFORM — the plugin registry of the shared container, and
   * what may be installed onto it. Both endpoints answer `platform_admin_required` to a site
   * administrator, so the tabs are not offered to one. Installed stays: a site's own plugin list and
   * each plugin's per-site settings are its business.
   */
  private get allTabs(): { label: string; href: string }[] {
    return [
      { label: AdminI18n.t('plugins.detail.installed'), href: AdminConstants.ROUTES.PLUGINS.INSTALLED },
      { label: AdminI18n.t('plugins.detail.health'), href: AdminConstants.ROUTES.PLUGINS.HEALTH },
      { label: AdminI18n.t('plugins.detail.marketplace'), href: AdminConstants.ROUTES.PLUGINS.MARKETPLACE },
    ];
  }

  /** The tabs offered here: all three to a platform admin in Platform scope, Installed only otherwise. */
  private get tabs(): { label: string; href: string }[] {
    if (!PlatformAccess.canManagePlatform(this.auth.user) || this.siteScope) return this.allTabs.slice(0, 1);
    return this.allTabs;
  }

  private get isMarketplace(): boolean {
    return this.pathname.startsWith(AdminConstants.ROUTES.PLUGINS.MARKETPLACE);
  }

  private get isHealth(): boolean {
    return this.pathname.startsWith(AdminConstants.ROUTES.PLUGINS.HEALTH);
  }

  private get isPluginDetail(): boolean {
    // A plugin's page lives under `installed/<slug>`; `/plugins/<slug>` is the older address of it.
    if (this.pathname.startsWith(`${AdminConstants.ROUTES.PLUGINS.INSTALLED}/`)) return true;
    return (
      this.pathname.startsWith(`${AdminConstants.ROUTES.PLUGINS.ROOT}/`) &&
      !this.pathname.startsWith(AdminConstants.ROUTES.PLUGINS.INSTALLED) &&
      !this.pathname.startsWith(AdminConstants.ROUTES.PLUGINS.HEALTH) &&
      !this.pathname.startsWith(AdminConstants.ROUTES.PLUGINS.MARKETPLACE)
    );
  }

  /** The page being shown — named by where it is, whether or not its tab is offered here (a bookmark, say). */
  private get activeTab(): { label: string; href: string } {
    const tabs = this.allTabs;
    return this.isMarketplace ? tabs[2] : this.isHealth ? tabs[1] : tabs[0];
  }

  render(): ReactNode {
    // A plugin's own page carries its own header (where you are, the plugin, its actions) and nothing
    // below it: the section header and the ecosystem footer belong to the lists.
    if (this.isPluginDetail) {
      return <div className="flex w-full flex-col animate-in fade-in duration-500">{this.children}</div>;
    }
    const isMarketplace = this.isMarketplace;
    const isHealth = this.isHealth;
    const tabs = this.tabs;
    const subtitle = isMarketplace
      ? AdminI18n.t('plugins.detail.discoverAndInstallPowerUps')
      : isHealth
        ? AdminI18n.t('plugins.detail.monitorPluginHealthHeldCapability')
        : AdminI18n.t('plugins.detail.manageYourExistingInstallationUpdates');
    // One tab is no choice: a site administrator sees the Installed list under its title alone.
    const nav = tabs.length > 1 ? (
      <nav className={AdminClass.of('page-tabs')}>
        {tabs.map((tab) => (
          <AdminLink key={tab.href} href={tab.href} className={AdminClass.of('page-tabs__tab')}
            aria-current={tab.href === this.activeTab.href ? 'page' : undefined}>
            {tab.label}
          </AdminLink>
        ))}
      </nav>
    ) : null;

    return (
      <div className="w-full animate-in fade-in duration-700">
        <CompactPageHeader title={this.activeTab.label} subtitle={subtitle} actions={nav} />
        <div className="w-full p-6">{this.children}</div>
      </div>
    );
  }
}
