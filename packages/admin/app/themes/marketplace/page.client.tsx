import { VersionComparisonService } from '@fromcode119/core/client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import type { ReactElement } from 'react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { ListCard } from '@/components/ui/view/list-card.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { Skeleton } from '@/components/ui/view/skeleton.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { Badge } from '@/components/ui/view/badge.client';
import { FrameworkIcons } from '@fromcode119/react';
import type { IMarketplaceTheme } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { state } from '@fromcode119/react-class-components';
import { PlatformSettingLocks } from '@/lib/settings/platform-setting-locks';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { EmptyState } from '@/components/ui/view/empty-state.client';

export class ThemesMarketplacePage extends AdminComponent {
  private mounted = false;

  @state themes: IMarketplaceTheme[] = [];
  @state installedThemes: any[] = [];
  @state loading = true;
  /** In a site the marketplace adds themes to THIS site; the shared copies are the platform's to update. */
  @state siteScope = false;

  componentDidMount(): void {
    this.mounted = true;
    void PlatformSettingLocks.load().then((locks) => {
      if (!this.mounted) return;
      this.siteScope = locks.isSiteScope();
      void this.fetchData();
    });
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async fetchData(): Promise<void> {
    const notify = this.runtime.notify.notify;
    this.loading = true;
    try {
      const [marketData, installedRes] = await Promise.all([
        AdminApi.get(AdminConstants.ENDPOINTS.THEMES.MARKETPLACE),
        AdminApi.get(AdminConstants.ENDPOINTS.THEMES.LIST)
      ]);

      const marketplace = Array.isArray(marketData) ? marketData : (marketData.themes || []);
      const installed = Array.isArray(installedRes) ? installedRes : (installedRes.themes || []);

      // One card per slug: its newest version, compared numerically. As strings "1.2.6" sorts above
      // "1.2.35", so an old build left in the catalogue became the card's version.
      const grouped: Record<string, IMarketplaceTheme> = {};
      marketplace.forEach((t: IMarketplaceTheme) => {
        if (!grouped[t.slug] || VersionComparisonService.isGreater(t.version, grouped[t.slug].version)) {
          grouped[t.slug] = t;
        }
      });

      if (!this.mounted) return;
      this.themes = Object.values(grouped);
      this.installedThemes = installed;
    } catch (err) {
      console.error("Failed to fetch marketplace themes", err);
      notify(NotificationType.ERROR, AdminI18n.t('themes.marketplaceError'), AdminI18n.t('themes.couldNotLoadMarketplaceThemes'));
    } finally {
      if (this.mounted) this.loading = false;
    }
  }

  private async handleInstall(slug: string, version: string): Promise<void> {
    const notify = this.runtime.notify.notify;
    const triggerRefresh = this.runtime.plugins?.triggerRefresh;
    try {
      if (this.siteScope) {
        await AdminApi.post(AdminConstants.ENDPOINTS.THEMES.ADD_TO_SITE(slug));
        notify(NotificationType.SUCCESS, AdminI18n.t('themes.addedToThisSite'), AdminI18n.t('themes.isNowOneOfThis', { slug: slug }));
      } else {
        notify(NotificationType.INFO, AdminI18n.t('themes.installing'), AdminI18n.t('themes.downloadingTheme', { slug: slug }));
        await AdminApi.post(`${AdminConstants.ENDPOINTS.THEMES.INSTALL(slug)}?version=${encodeURIComponent(version)}`);
        notify(NotificationType.SUCCESS, AdminI18n.t('themes.installed'), AdminI18n.t('themes.themeIsNowAvailable', { slug: slug }));
      }
      if (triggerRefresh) triggerRefresh();
      void this.fetchData(); // Refresh list to show installed state
    } catch (err: any) {
      notify(NotificationType.ERROR, AdminI18n.t('themes.installationFailed'), err.message);
    }
  }

  /** The one thing to do with a theme of the catalogue, by what it is here. */
  private action(t: IMarketplaceTheme, installed: any, hasUpdate: boolean): ReactElement {
    if (installed && !hasUpdate) {
      return <Button variant={ButtonVariant.SECONDARY} icon={<FrameworkIcons.Check size={15} />} onClick={() => this.router.push(AdminConstants.ROUTES.THEMES.DETAIL(t.slug))}>{AdminI18n.t('themes.manageTheme')}</Button>;
    }
    if (hasUpdate) {
      return <Button variant={ButtonVariant.PRIMARY} icon={<FrameworkIcons.Refresh size={15} />} onClick={() => void this.handleInstall(t.slug, t.version)}>{AdminI18n.t('themes.upgradeNow')}</Button>;
    }
    return <Button variant={ButtonVariant.SECONDARY} icon={<FrameworkIcons.Download size={15} />} onClick={() => void this.handleInstall(t.slug, t.version)}>{this.siteScope ? AdminI18n.t('themes.addToThisSite') : AdminI18n.t('themes.installNow')}</Button>;
  }

  render(): ReactElement {
    const { themes, installedThemes, loading } = this;

    if (loading) {
      // The shape of the rows that are coming, so the list does not jump when they arrive.
      return (
        <ListCard>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="fc-ext-row">
              <Skeleton width={32} height={32} />
              <div className="fc-ext-row__text fc-stack"><Skeleton height={12} width="30%" /><Skeleton height={12} width="60%" /></div>
            </div>
          ))}
        </ListCard>
      );
    }

    if (themes.length === 0) {
      return <ListCard><EmptyState icon={<FrameworkIcons.ShoppingBag size={18} />} title={AdminI18n.t('themes.marketplaceEmpty')} hint={AdminI18n.t('themes.checkYourMarketplaceConnectionOr')} /></ListCard>;
    }

    // The same rows the list of installed themes is made of, so the catalogue and what is installed
    // read as one program.
    return (
      <ListCard>
        {themes.map((t) => {
          const installed = installedThemes.find((it) => it.slug === t.slug);
          // A site never updates the shared copy, so it is never offered one. Only a strictly NEWER
          // version is an update: an older one in the catalogue would be a downgrade.
          const installedVersion: string = installed?.version || '';
          const hasUpdate = !this.siteScope && Boolean(installed) && VersionComparisonService.isGreater(t.version, installedVersion);
          return (
            <ListRow
              key={t.slug}
              icon={t.iconUrl ? <img src={t.iconUrl} alt="" /> : <FrameworkIcons.Palette size={16} />}
              title={<button type="button" className="fc-ext-row__link" onClick={() => this.router.push(AdminConstants.ROUTES.THEMES.MARKETPLACE_DETAIL(t.slug))}>{t.name}</button>}
              badges={(
                <>
                  {hasUpdate ? <Badge variant={BadgeVariant.WARNING}>{AdminI18n.t('themes.updateAvailableVersion', { version: t.version })}</Badge> : null}
                  {installed && !hasUpdate ? <Badge variant={BadgeVariant.SUCCESS}>{this.siteScope ? AdminI18n.t('themes.inThisSite') : AdminI18n.t('themes.installed')}</Badge> : null}
                </>
              )}
              description={t.description || undefined}
              descriptionTitle={t.description || undefined}
              meta={[installed && installedVersion ? AdminI18n.t('themes.installedVersionLabel', { version: installedVersion }) : '', `v${t.version}`, t.author].filter(Boolean).join(' · ')}
              actions={this.action(t, installed, hasUpdate)}
            />
          );
        })}
      </ListCard>
    );
  }
}
