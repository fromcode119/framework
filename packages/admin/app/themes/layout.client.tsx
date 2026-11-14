import type { ReactNode } from 'react';
import { AdminLink } from '@/components/view/admin-link.client';
import { prop } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { AdminClass } from '@/lib/admin-class';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class ThemesLayout extends AdminComponent {
  @prop declare children: ReactNode;

  private get tabs(): Array<{ label: string; href: string }> {
    return [
      { label: AdminI18n.t('themes.installed'), href: AdminConstants.ROUTES.THEMES.INSTALLED },
      { label: AdminI18n.t('themes.marketplace'), href: AdminConstants.ROUTES.THEMES.MARKETPLACE },
    ];
  }

  private get isMarketplace(): boolean {
    return this.pathname.startsWith(AdminConstants.ROUTES.THEMES.MARKETPLACE);
  }

  private get isDetailPage(): boolean {
    const pathname = this.pathname;
    return (
      pathname.startsWith(`${AdminConstants.ROUTES.THEMES.ROOT}/`) &&
      !pathname.startsWith(AdminConstants.ROUTES.THEMES.MARKETPLACE) &&
      pathname !== AdminConstants.ROUTES.THEMES.INSTALLED &&
      pathname !== AdminConstants.ROUTES.THEMES.ROOT
    );
  }

  /** Logic to determine active tab strictly */
  private get activeTab(): { label: string; href: string } {
    return this.isMarketplace ? this.tabs[1] : this.tabs[0];
  }

  render(): ReactNode {
    // A theme's own page carries its own header (where you are, the theme, its actions) and nothing below
    // it: the section header and the footer belong to the lists.
    if (this.isDetailPage) {
      return <div className="flex w-full flex-col animate-in fade-in duration-500">{this.children}</div>;
    }
    const { isMarketplace, activeTab } = this;
    const subtitle = isMarketplace
      ? AdminI18n.t('themes.discoverAndInstallVisualStyles')
      : AdminI18n.t('themes.manageYourExistingInstallationLayout');
    const nav = (
      <nav className={AdminClass.of('page-tabs')}>
        {this.tabs.map((tab) => (
          <AdminLink key={tab.href} href={tab.href} className={AdminClass.of('page-tabs__tab')}
            aria-current={tab.href === activeTab.href ? 'page' : undefined}>
            {tab.label}
          </AdminLink>
        ))}
      </nav>
    );

    return (
      <div className="w-full animate-in fade-in duration-700">
        <CompactPageHeader title={activeTab.label} subtitle={subtitle} actions={nav} />
        <div className="w-full p-6">{this.children}</div>
      </div>
    );
  }
}
