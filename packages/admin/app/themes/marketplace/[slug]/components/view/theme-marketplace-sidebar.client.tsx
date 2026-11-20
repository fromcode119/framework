import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import type { IMarketplaceTheme } from '@fromcode119/core/client';
import { FrameworkIcons } from '@fromcode119/react';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { AdminFactGrid } from '@/components/ui/view/admin-fact-grid.client';
import { StateBadge } from '@/components/ui/view/state-badge.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMarketplaceDependencyCard } from '@/app/themes/marketplace/[slug]/components/view/theme-marketplace-dependency-card.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** Whether the theme is here, which version, and the one action: install it, update it, or add it to this site. */
export class ThemeMarketplaceSidebar extends PureReactor {
  @prop declare theme: IMarketplaceTheme;
  @prop declare installedTheme: any | null;
  @prop declare installedVersion: string | null;
  @prop declare hasUpdate: boolean;
  @prop declare installing: boolean;
  @prop declare onInstall: () => void;
  /** In a site: the button adds the theme to this site. */
  @prop declare siteScope: boolean;

  private get action(): { label: string; icon: ReactNode } | null {
    if (this.installedTheme && !this.hasUpdate) return null;
    if (this.siteScope) return { label: this.installing ? AdminI18n.t('themes.adding') : AdminI18n.t('themes.addToThisSite'), icon: <FrameworkIcons.Download size={15} /> };
    if (this.hasUpdate) return { label: this.installing ? AdminI18n.t('themes.installing') : AdminI18n.t('themes.updateNow'), icon: <FrameworkIcons.Refresh size={15} /> };
    return { label: this.installing ? AdminI18n.t('themes.installing') : AdminI18n.t('themes.installTheme2'), icon: <FrameworkIcons.Download size={15} /> };
  }

  render(): ReactNode {
    const { theme, installedTheme, installedVersion, hasUpdate, installing, onInstall } = this;
    const action = this.action;
    const state = !installedTheme
      ? null
      : hasUpdate
        ? <StateBadge tone="warning">{AdminI18n.t('themes.upgradeAvailable')}</StateBadge>
        : <StateBadge tone="success">{this.siteScope ? AdminI18n.t('themes.inThisSite') : AdminI18n.t('themes.installed')}</StateBadge>;
    return (
      <>
        <RecordCard title={installedTheme ? AdminI18n.t('themes.installed') : AdminI18n.t('themes.installTheme2')} aside={state}>
          <div className="fc-stack">
            {action ? (
              <Button variant={ButtonVariant.PRIMARY} block isLoading={installing} icon={action.icon} onClick={onInstall}>{action.label}</Button>
            ) : null}
            <AdminFactGrid facts={[
              { key: 'installed', label: AdminI18n.t('themes.installedRelease'), value: installedVersion ? `v${installedVersion}` : AdminI18n.t('themes.notInstalled') },
              { key: 'marketplace', label: AdminI18n.t('themes.marketplaceRelease'), value: `v${theme.version}` },
            ] as any} />
          </div>
        </RecordCard>
        <ThemeMarketplaceDependencyCard theme={theme} />
      </>
    );
  }
}
